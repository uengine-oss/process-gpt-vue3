# cat <<EOF > /opt/www/static/config.js
# window._env_ = {
#   DB_URL: "${DB_URL}",
#   DB_PW: "${DB_PW}"
# }
# EOF

http-server /opt/www -p 8080 -d false --push-state