# To build:  podman build -t demo-extension-metrics-server:latest .
# To run:    podman run -it --rm -p 9090:9090 demo-extension-metrics-server:latest
# To access: curl http://localhost:9090

FROM registry.access.redhat.com/ubi9/ubi:latest
RUN yum install -y nc
COPY emit-metrics.sh /metrics-server/
RUN chmod +x /metrics-server/emit-metrics.sh
CMD ["/metrics-server/emit-metrics.sh"]
