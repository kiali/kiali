package main

import (
	"flag"
	"log"

	"github.com/jtblin/go-ldap-client"
)

var base, bindDN, bindPassword, groupFilter, host, password, serverName, userFilter, username string
var port int
var useSSL bool

type server struct{}

func main() {
	flag.Parse()

	client := &ldap.LDAPClient{
		Base:         base,
		Host:         host,
		Port:         port,
		UseSSL:       useSSL,
		BindDN:       bindDN,
		BindPassword: bindPassword,
		UserFilter:   userFilter,
		GroupFilter:  groupFilter,
		Attributes:   []string{"givenName", "sn", "mail", "uid"},
		ServerName:   serverName,
	}
	defer client.Close()

	ok, user, err := client.Authenticate(username, password)
	if err != nil {
		log.Fatalf("Error authenticating user %s: %+v", username, err)
	}
	if !ok {
		log.Fatalf("Authenticating failed for user %s", username)
	}
	log.Printf("User: %+v", user)

	groups, err := client.GetGroupsOfUser(username)
	if err != nil {
		log.Fatalf("Error getting groups for user %s: %+v", username, err)
	}
	log.Printf("Groups: %+v", groups)
}

func init() {
	flag.StringVar(&base, "base", "dc=example,dc=com", "Base LDAP")
	flag.StringVar(&bindDN, "bind-dn", "uid=readonlysuer,ou=People,dc=example,dc=com", "Bind DN")
	flag.StringVar(&bindPassword, "bind-pwd", "readonlypassword", "Bind password")
	flag.StringVar(&groupFilter, "group-filter", "(memberUid=%s)", "Group filter")
	flag.StringVar(&host, "host", "ldap.example.com", "LDAP host")
	flag.StringVar(&password, "password", "", "Password")
	flag.IntVar(&port, "port", 389, "LDAP port")
	flag.StringVar(&userFilter, "user-filter", "(uid=%s)", "User filter")
	flag.StringVar(&username, "username", "", "Username")
	flag.StringVar(&serverName, "server-name", "", "Server name for SSL (if use-ssl is set)")
	flag.BoolVar(&useSSL, "use-ssl", false, "Use SSL")
}
