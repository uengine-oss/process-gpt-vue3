FROM sanghoon01/spa-http-server:v1
#
#RUN npm install -g spa-http-server

# ARG DB_URL
# ARG DB_PW
ARG SUPABASE_URL
ARG SUPABASE_KEY

ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_KEY=${SUPABASE_KEY}

ADD dist /opt/www
ADD .env /opt/www
ADD .env /opt/www/.env
ADD run.sh /opt/run.sh
EXPOSE 8080
ENTRYPOINT ["sh","/opt/run.sh"]