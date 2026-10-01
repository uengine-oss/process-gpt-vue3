# Spring Boot 4 는 Java 17+ 가 필요하다. 실행에는 JRE 만 있으면 된다.
FROM eclipse-temurin:21-jre

# 타임존 설정
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin gateway

# 애플리케이션 JAR 파일 복사
COPY --chown=10001:10001 target/*SNAPSHOT.jar /app/app.jar

# 포트 노출
EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

# root 가 아닌 사용자로 실행
USER 10001

# 애플리케이션 실행
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar /app/app.jar --spring.profiles.active=${SPRING_PROFILES_ACTIVE:-docker}"]
