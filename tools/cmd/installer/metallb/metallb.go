package metallb

import (
	"encoding/json"
	"fmt"
	"net/netip"
	"os/exec"
	"strings"

	"github.com/rs/zerolog"
)

// Pool is a named MetalLB IPAddressPool with a single CIDR range.
type Pool struct {
	Name    string
	Address netip.Prefix
}

// Deploy installs MetalLB and configures IP address pools on the given cluster.
// It returns immediately with a channel that closes when MetalLB is fully configured,
// or receives an error if any step fails.
// If lbPrefix is invalid, a default is derived from the container network subnets.
// Any extra pools are created alongside the main pool.
func Deploy(kubeContext string, lbPrefix netip.Prefix, dockerOrPodman, ipFamily string, logger *zerolog.Logger, extraPools ...Pool) <-chan error {
	ch := make(chan error, 1)
	go func() {
		defer close(ch)
		if err := deploy(kubeContext, lbPrefix, dockerOrPodman, ipFamily, logger, extraPools); err != nil {
			ch <- err
		}
	}()
	return ch
}

func deploy(kubeContext string, lbPrefix netip.Prefix, dockerOrPodman, ipFamily string, logger *zerolog.Logger, extraPools []Pool) error {
	logger.Info().Msgf("Creating Kind LoadBalancer via MetalLB on %s", kubeContext)

	if err := kubectl(kubeContext, "apply", "-f",
		"https://raw.githubusercontent.com/metallb/metallb/v0.13.10/config/manifests/metallb-native.yaml").Run(); err != nil {
		return fmt.Errorf("applying MetalLB manifests: %w", err)
	}

	logger.Info().Msgf("Waiting for MetalLB controller and speaker to be ready on %s", kubeContext)
	if output, err := kubectl(kubeContext, "rollout", "status", "deployment", "controller", "-n", "metallb-system").CombinedOutput(); err != nil {
		return fmt.Errorf("waiting for MetalLB controller: %s: %w", output, err)
	}
	if output, err := kubectl(kubeContext, "rollout", "status", "daemonset", "speaker", "-n", "metallb-system").CombinedOutput(); err != nil {
		return fmt.Errorf("waiting for MetalLB speaker: %s: %w", output, err)
	}

	if !lbPrefix.IsValid() {
		subnet, err := detectSubnet(dockerOrPodman, ipFamily)
		if err != nil {
			return fmt.Errorf("detecting network subnet: %w", err)
		}

		parts := strings.Split(subnet, ".")
		if len(parts) < 2 {
			return fmt.Errorf("invalid subnet format: %s", subnet)
		}
		addr, err := netip.ParseAddr(parts[0] + "." + parts[1] + ".255.0")
		if err != nil {
			return fmt.Errorf("parsing default LB address: %w", err)
		}
		lbPrefix = netip.PrefixFrom(addr, 24)
	}

	// When extra pools reserve addresses from the main range, use a range
	// format that excludes them to avoid MetalLB's overlap validation.
	mainRange := lbPrefix.String()
	if len(extraPools) > 0 {
		mainRange = fmt.Sprintf("%s-%s", lbPrefix.Addr().Next(), lastAddr(lbPrefix))
	}

	logger.Info().Msgf("LoadBalancer IP Address pool on %s: %s", kubeContext, mainRange)

	poolManifest := fmt.Sprintf(`apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: config
spec:
  addresses:
  - %s`, mainRange)

	cmd := kubectl(kubeContext, "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(poolManifest)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("creating IPAddressPool: %s: %w", output, err)
	}

	for _, pool := range extraPools {
		addr := pool.Address.Addr().String()
		manifest := fmt.Sprintf(`apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: %s
spec:
  autoAssign: false
  addresses:
  - %s-%s`, pool.Name, addr, addr)

		cmd = kubectl(kubeContext, "apply", "-f", "-")
		cmd.Stdin = strings.NewReader(manifest)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("creating IPAddressPool %s: %s: %w", pool.Name, output, err)
		}
	}

	l2Manifest := `apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  namespace: metallb-system
  name: l2config`

	cmd = kubectl(kubeContext, "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(l2Manifest)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("creating L2Advertisement: %s: %w", output, err)
	}

	return nil
}

func lastAddr(p netip.Prefix) netip.Addr {
	raw := p.Addr().As4()
	a := uint32(raw[0])<<24 | uint32(raw[1])<<16 | uint32(raw[2])<<8 | uint32(raw[3])
	a += 1<<(32-p.Bits()) - 1
	return netip.AddrFrom4([4]byte{byte(a >> 24), byte(a >> 16), byte(a >> 8), byte(a)})
}

func kubectl(kubeContext string, args ...string) *exec.Cmd {
	return exec.Command("kubectl", append([]string{"--context", kubeContext}, args...)...)
}

func detectSubnet(dockerOrPodman, ipFamily string) (string, error) {
	output, err := exec.Command(dockerOrPodman, "network", "inspect", "kind").Output()
	if err != nil {
		return "", fmt.Errorf("inspecting %s network: %w", dockerOrPodman, err)
	}

	is4 := ipFamily == "ipv4"

	switch dockerOrPodman {
	case "docker":
		var networks []struct {
			IPAM struct {
				Config []struct {
					Subnet string `json:"Subnet"`
				} `json:"Config"`
			} `json:"IPAM"`
		}
		if err := json.Unmarshal(output, &networks); err != nil {
			return "", fmt.Errorf("parsing docker network JSON: %w", err)
		}
		if len(networks) == 0 {
			return "", fmt.Errorf("no docker network found")
		}
		for _, cfg := range networks[0].IPAM.Config {
			prefix, err := netip.ParsePrefix(cfg.Subnet)
			if err != nil {
				continue
			}
			if is4 == prefix.Addr().Is4() {
				return cfg.Subnet, nil
			}
		}

	case "podman":
		var networks []struct {
			Subnets []struct {
				Subnet string `json:"subnet"`
			} `json:"subnets"`
		}
		if err := json.Unmarshal(output, &networks); err != nil {
			return "", fmt.Errorf("parsing podman network JSON: %w", err)
		}
		if len(networks) == 0 {
			return "", fmt.Errorf("no podman network found")
		}
		for _, s := range networks[0].Subnets {
			prefix, err := netip.ParsePrefix(s.Subnet)
			if err != nil {
				continue
			}
			if is4 == prefix.Addr().Is4() {
				return s.Subnet, nil
			}
		}

	default:
		return "", fmt.Errorf("unsupported container runtime: %s", dockerOrPodman)
	}

	return "", fmt.Errorf("no matching subnet found for IP family %s", ipFamily)
}
