FROM maven:3.9-eclipse-temurin-17 AS java-builder
WORKDIR /build
COPY java-parser/pom.xml ./pom.xml
COPY java-parser/src ./src
RUN mvn -q -DskipTests package

FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY server-v2.mjs ./server-v2.mjs
COPY --from=java-builder /build/target/lps-mpp-converter.jar /app/java/lps-mpp-converter.jar
ENV NODE_ENV=production
ENV PORT=8787
ENV MPXJ_FAT_JAR=/app/java/lps-mpp-converter.jar
EXPOSE 8787
CMD ["node","server-v2.mjs"]
