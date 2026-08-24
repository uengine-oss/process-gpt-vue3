#/bin/bash

# 아래의 프로젝트 이름, 버전 이름, 소스 코드 위치, 배포 방법 등 수정
export PROJECT_NAME="ProcessGPT"
export VERSION_NAME="1.0.0"
export SOURCE_PATH="/Users/kimsanghoon/IdeaProjects/process-gpt-vue3/"
export SYNOPSYS_DETECT="/Users/kimsanghoon/SKT/detect-10.5.0.jar"
export DISTRIBUTION="EXTERNAL"


current_time=$(date +"%Y-%m-%d_%H-%M-%S")
log_file="log_${current_time}.log"
java -jar ${SYNOPSYS_DETECT} \
    --blackduck.url=https://blackduck.sktelecom.com \
    --blackduck.trust.cert=true \
    --blackduck.api.token=YjUwZWNkYTktOTkzNS00YzgwLWE0ODEtNTNlOTgzZGZlZTRlOjkxZDUyNTExLTMyNjAtNDM1MC04MjllLWM2ZTE3OTlkMzhjOA== \
    --detect.project.name=${PROJECT_NAME} \
    --detect.project.version.name=${VERSION_NAME} \
    --detect.source.path=${SOURCE_PATH} \
	--detect.project.version.distribution=${DISTRIBUTION} \
	--detect.blackduck.signature.scanner.snippet.matching=SNIPPET_MATCHING \
    --detect.blackduck.signature.scanner.upload.source.mode=true \
    --logging.level.detect=DEBUG \
    --blackduck.offline.mode=false \
    --detect.excluded.detector.types=RUBYGEMS,GIT \
    --detect.pub.dependency.types.excluded=DEV \
    --detect.go.mod.dependency.types.excluded=UNUSED \
    --detect.maven.excluded.scopes=test \
    --detect.npm.dependency.types.excluded=DEV \
    --detect.nuget.dependency.types.excluded=DEV \
    --detect.pipfile.dependency.types.excluded=DEV \
    --detect.pnpm.dependency.types.excluded=DEV \
    --detect.yarn.dependency.types.excluded=NON_PRODUCTION \
    --detect.gradle.excluded.configurations=testImplementation,testCompileClasspath,testRuntimeClasspath \
	--detect.detector.search.depth=5 \
	--detect.clone.project.version.latest=true \
	--detect.project.version.license="Basic Proprietary Commercial License"
    2>&1 | tee $log_file