# Edge — TLS terminator + name-based virtual host router.
# Config only: it builds no apps. The app/api images serve their own content;
# this image just removes the stock welcome config so the mounted per-vhost
# templates render into conf.d/ as the only servers.
FROM nginx:1.30-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
EXPOSE 80 443
