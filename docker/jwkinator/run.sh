step crypto jwk create /etc/config/kratos-keys/es256.pub.jwk.json /etc/config/kratos-keys/es256.jwk.json --from-pem /etc/config/private.pem --no-password --insecure -f
rm -f /etc/config/kratos-keys/jwks.priv.json
rm -f /etc/config/kratos-keys/.well-known/jwks.json
step crypto jwk keyset add /etc/config/kratos-keys/jwks.priv.json < /etc/config/kratos-keys/es256.jwk.json
step crypto jwk keyset add /etc/config/kratos-keys/.well-known/jwks.json < /etc/config/kratos-keys/es256.pub.jwk.json
