package ldap

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/jtblin/go-ldap-client"
	ldapv2 "gopkg.in/ldap.v2"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

//ValidateUser validates user by extracting creds from the request body, then
//    authenticating against an ID backend and filling out the User struct therefrom
func ValidateUser(req *http.Request, authConfig config.AuthConfig) (User, error) {

	// access LDAP as the user we are validating
	username, pwd, _ := req.BasicAuth()

	log.Debugf("Connecting to LDAP with config: %v", authConfig)
	bindDN := strings.Replace(authConfig.LDAP.LDAPBindDN, "{USERID}", username, -1)
	log.Debugf("bindDN : %s", bindDN)

	ldapAttributes := []string{authConfig.LDAP.LDAPMemberOfKey, authConfig.LDAP.LDAPUserIDKey, authConfig.LDAP.LDAPMailIDKey}
	client := ldap.LDAPClient{
		Base:               authConfig.LDAP.LDAPBase,
		Host:               authConfig.LDAP.LDAPHost,
		Port:               authConfig.LDAP.LDAPPort,
		UseSSL:             authConfig.LDAP.LDAPUseSSL,
		InsecureSkipVerify: authConfig.LDAP.LDAPInsecureSkipVerify,
		BindDN:             bindDN,
		BindPassword:       pwd,
		UserFilter:         authConfig.LDAP.LDAPUserFilter,
		GroupFilter:        authConfig.LDAP.LDAPGroupFilter,
		Attributes:         ldapAttributes,
	}
	defer client.Close()

	// uname and password (ID) correct?
	authOk, err := isAuthenticated(&client, username, pwd)

	if authOk { // get the rest of the info for this person -- groups, app ownershop etc.
		user, err := getUser(&client, username, strings.ToLower(strings.TrimSpace(authConfig.LDAP.LDAPRoleFilter)), authConfig)
		return user, err
	}
	log.Debugf("Authentication failed with LDAP : %v", err)
	return User{}, err
}

// isAuthenticated checks whether uname and password are correct according to ID (LDAP currently) backend
func isAuthenticated(ldapClient *ldap.LDAPClient, username, password string) (bool, error) {
	ok, _, err := ldapClient.Authenticate(username, password)
	if err != nil {
		log.Errorf("Error authenticating user %s: %+v", username, err)
		return false, err
	}
	if !ok {
		log.Errorf("Authenticating failed for user %s", username)
		return false, err
	}
	return true, nil
}

// getUser takes a structure with only the bare creds filled in and consults the roles backend (LDAP) to return
// a completely filled out structure with uid, username, groups and app ownership information
func getUser(ldapClient *ldap.LDAPClient, username, roleFilter string, authConfig config.AuthConfig) (User, error) {
	groups := []string{}
	var user User

	ldapAttributes := []string{authConfig.LDAP.LDAPMemberOfKey, authConfig.LDAP.LDAPUserIDKey, authConfig.LDAP.LDAPMailIDKey}
	searchFilter := strings.Replace(authConfig.LDAP.LDAPSearchFilter, "{USERID}", username, -1)
	searchRequest := ldapv2.NewSearchRequest(
		authConfig.LDAP.LDAPBase,
		ldapv2.ScopeWholeSubtree,
		ldapv2.NeverDerefAliases, 0, 0, false,
		searchFilter,
		ldapAttributes,
		nil,
	)
	sr, err := ldapClient.Conn.Search(searchRequest)
	if err != nil {
		log.Errorf("Error searching LDAP : %s", err.Error())
		return user, err
	}

	var roleFilterRegEx = regexp.MustCompile(roleFilter)

	if roleFilter != "" {
		log.Debugf("Generating token with Role Filter")
	} else {
		log.Debugf("No Role Filter type is received from user. Generating token with out Role Filter")
	}

	for _, entry := range sr.Entries {
		for _, attr := range entry.Attributes {
			if attr.Name == authConfig.LDAP.LDAPUserIDKey {
				user.UID = attr.Values[0] //There will always be one CN
			} else if attr.Name == authConfig.LDAP.LDAPMailIDKey {
				user.Username = attr.Values[0] //There will always be one mail
			} else {
				for _, value := range attr.Values {
					groupName := value[strings.Index(value, "CN=")+3 : strings.Index(value, ",")]
					if roleFilter != "" {
						if roleFilterRegEx.MatchString(groupName) {
							groups = append(groups, groupName)
						}
					} else {
						groups = append(groups, groupName)
					}
				}
				user.Groups = groups
			}
		}
	}

	if len(user.Groups) == 0 {
		log.Infof("User is not member of any valid LDAP group(Recheck the roleFilter)")
	}

	if user.Username == "" {
		user.Username = user.UID
	}

	return user, nil
}
