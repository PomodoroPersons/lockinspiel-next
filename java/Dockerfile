FROM maven:3.9-eclipse-temurin-26 AS builder
WORKDIR /application
ARG PACKAGE
COPY ./spring_packages/${PACKAGE}/pom.xml pom.xml
RUN mvn dependency:go-offline -B
COPY ./spring_packages/${PACKAGE} .
RUN mvn clean package -DskipTests
ARG JAR_FILE=target/*.jar
RUN java -Djarmode=layertools -jar $JAR_FILE extract

FROM eclipse-temurin:26
WORKDIR /application
COPY --from=builder /application/dependencies/ ./
COPY --from=builder /application/spring-boot-loader/ ./
COPY --from=builder /application/snapshot-dependencies/ ./
COPY --from=builder /application/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
