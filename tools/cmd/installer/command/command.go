package command

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

type Cmd struct {
	cmd *exec.Cmd
}

func Command(name string, args ...string) *Cmd {
	cmd := exec.Command(name, args...)
	return &Cmd{cmd: cmd}
}

func (c *Cmd) WithDir(dir string) *Cmd {
	c.cmd.Dir = dir
	return c
}

func (c *Cmd) WithInput(r io.Reader) *Cmd {
	c.cmd.Stdin = r
	return c
}

func (c *Cmd) WithEnv(env ...string) *Cmd {
	c.cmd.Env = append(os.Environ(), env...)
	return c
}

func (c *Cmd) Run() error {
	var stderrBuf bytes.Buffer
	c.cmd.Stderr = &stderrBuf

	if err := c.cmd.Run(); err != nil {
		return fmt.Errorf("error executing command: %s: %s", c.cmd, stderrBuf.String())
	}

	return nil
}

func (c *Cmd) Output() (string, error) {
	var stdout, stderr bytes.Buffer
	c.cmd.Stdout = &stdout
	c.cmd.Stderr = &stderr

	if err := c.cmd.Run(); err != nil {
		return stdout.String() + stderr.String(), fmt.Errorf("error executing command: %s: %s", c.cmd, stderr.String())
	}

	return stdout.String(), nil
}

func ServerSideApply(kubeContext, yaml string) error {
	return Command("kubectl", "--context", kubeContext,
		"apply", "--server-side", "--field-manager=kiali-installer", "--force-conflicts", "-f", "-").
		WithInput(strings.NewReader(yaml)).Run()
}
