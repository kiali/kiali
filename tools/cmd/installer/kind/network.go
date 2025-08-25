package kind

import (
	"encoding/json"
	"fmt"
	"math/bits"
	"net/netip"
	"os/exec"
	"strings"
)

// NetworkInfo holds the detected subnet information for the kind Docker network.
type NetworkInfo struct {
	// SubnetPrefix is the first two octets of the subnet, e.g. "172.18".
	SubnetPrefix string
}

// EnsureKindNetwork creates the "kind" container network if it doesn't
// already exist, then inspects it and returns the detected subnet info.
// Works with both docker and podman.
func EnsureKindNetwork(dorp string) (*NetworkInfo, error) {
	_ = exec.Command(dorp, "network", "create", "kind").Run()

	out, err := exec.Command(dorp, "network", "inspect", "kind").Output()
	if err != nil {
		return nil, fmt.Errorf("inspecting kind network: %w", err)
	}

	prefix, err := parseSubnetPrefix(dorp, out)
	if err != nil {
		return nil, err
	}

	return &NetworkInfo{SubnetPrefix: prefix}, nil
}

func parseSubnetPrefix(dorp string, inspectJSON []byte) (string, error) {
	var subnet string

	switch dorp {
	case "docker":
		var networks []struct {
			IPAM struct {
				Config []struct {
					Subnet string `json:"Subnet"`
				} `json:"Config"`
			} `json:"IPAM"`
		}
		if err := json.Unmarshal(inspectJSON, &networks); err != nil {
			return "", fmt.Errorf("parsing docker network JSON: %w", err)
		}
		for _, cfg := range networks[0].IPAM.Config {
			if strings.Contains(cfg.Subnet, ".") {
				subnet = cfg.Subnet
				break
			}
		}
	case "podman":
		var networks []struct {
			Subnets []struct {
				Subnet string `json:"subnet"`
			} `json:"subnets"`
		}
		if err := json.Unmarshal(inspectJSON, &networks); err != nil {
			return "", fmt.Errorf("parsing podman network JSON: %w", err)
		}
		for _, s := range networks[0].Subnets {
			if strings.Contains(s.Subnet, ".") {
				subnet = s.Subnet
				break
			}
		}
	default:
		return "", fmt.Errorf("unsupported container runtime: %s", dorp)
	}

	if subnet == "" {
		return "", fmt.Errorf("no IPv4 subnet found in kind network")
	}

	parts := strings.Split(subnet, ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("unexpected subnet format: %s", subnet)
	}

	return parts[0] + "." + parts[1], nil
}

// AllocateLoadBalancerPrefixes subdivides the last /24 of the kind network
// into equal CIDR prefixes, one per cluster. For 2 clusters this produces
// two /25s, for 3-4 clusters four /26s, etc.
//
// The first address in the first prefix is deterministic and can be reserved
// for a known service like Keycloak.
func AllocateLoadBalancerPrefixes(subnetPrefix string, count int) ([]netip.Prefix, error) {
	base, err := netip.ParseAddr(subnetPrefix + ".255.0")
	if err != nil {
		return nil, fmt.Errorf("parsing base address: %w", err)
	}

	extraBits := bits.Len(uint(count - 1))
	prefixLen := 24 + extraBits
	subnetSize := uint32(1) << (32 - prefixLen)

	prefixes := make([]netip.Prefix, count)
	raw := base.As4()
	addr := uint32(raw[0])<<24 | uint32(raw[1])<<16 | uint32(raw[2])<<8 | uint32(raw[3])

	for i := range count {
		a := addr + uint32(i)*subnetSize
		prefixes[i] = netip.PrefixFrom(
			netip.AddrFrom4([4]byte{byte(a >> 24), byte(a >> 16), byte(a >> 8), byte(a)}),
			prefixLen,
		)
	}

	return prefixes, nil
}
