
FROM python:2.7

# Copy the application's requirements.txt and run pip to install all
ADD requirements.txt  requirements.txt
RUN pip install -r requirements.txt


COPY traffic.py .

CMD locust -f traffic.py --host ${PRODUCT_PAGE_BASE_ROUTE} -c ${NUMBER_OF_CLIENTS}  --print-stats --no-web
