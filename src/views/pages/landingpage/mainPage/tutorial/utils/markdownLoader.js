// 마크다운 파일 로더 유틸리티

export class MarkdownLoader {
    constructor() {
        this.cache = new Map();
    }

    // frontmatter 파싱
    parseFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return {
                frontmatter: {},
                content: content
            };
        }

        const frontmatterText = match[1];
        const markdownContent = match[2];
        
        const frontmatter = {};
        frontmatterText.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
                frontmatter[key.trim()] = value;
            }
        });

        return {
            frontmatter,
            content: markdownContent
        };
    }

    // 마크다운을 HTML로 변환
    parseMarkdown(content) {
        let result = content;
        
        
        // 이미지 처리를 먼저 수행
        result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            
            // 이미지 경로 처리 - uengine-image 폴더 기준으로 변경
            let imageSrc = src;
            
            // 상대 경로인 경우 실제 uengine-image 폴더 기준으로 변환
            if (src.startsWith('../../uengine-image/')) {
                imageSrc = `/src/views/pages/landingpage/mainPage/uengine-image/${src.replace('../../uengine-image/', '')}`;
            } else if (src.startsWith('../uengine-image/')) {
                imageSrc = `/src/views/pages/landingpage/mainPage/uengine-image/${src.replace('../uengine-image/', '')}`;
            } else if (src.startsWith('uengine-image/')) {
                imageSrc = `/src/views/pages/landingpage/mainPage/uengine-image/${src.replace('uengine-image/', '')}`;
            }
            
            return `<img src="${imageSrc}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin: 16px 0;" />`;
        });
        
        // 테이블 처리 먼저 수행
        result = this.parseTable(result);
        
        // 나머지 마크다운 처리
        result = result
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/```[\s\S]*?```/g, (match) => {
                const code = match.replace(/```/g, '').trim();
                return `<pre><code>${code}</code></pre>`;
            })
            .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
            .replace(/^-\s(.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, (match) => {
                if (match.includes('1.')) {
                    return `<ol>${match}</ol>`;
                }
                return `<ul>${match}</ul>`;
            })
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h\d|ul|ol|pre|img|a])(.+)$/gm, '<p>$1</p>')
            .replace(/<p><\/p>/g, '');
            
        return result;
    }

    // 테이블 파싱
    parseTable(content) {
        // 테이블 패턴 매칭 (헤더 | 구분선 | 데이터 행들)
        const tableRegex = /(\|.+\|\s*\n\|[-\s|:]+\|\s*\n(?:\|.+\|\s*\n?)*)/gm;
        
        return content.replace(tableRegex, (match) => {
            
            const lines = match.trim().split('\n');
            if (lines.length < 3) return match; // 최소 헤더, 구분선, 데이터 1행 필요
            
            let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #e5e7eb;">\n';
            
            // 헤더 처리
            const headerLine = lines[0];
            const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
            tableHTML += '<thead style="background-color: #f9fafb;">\n<tr>\n';
            headers.forEach(header => {
                tableHTML += `<th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-weight: 600;">${header}</th>\n`;
            });
            tableHTML += '</tr>\n</thead>\n';
            
            // 데이터 행 처리 (구분선 제외하고 2행부터)
            tableHTML += '<tbody>\n';
            for (let i = 2; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim()) {
                    const cells = line.split('|').map(c => c.trim()).filter(c => c);
                    tableHTML += '<tr>\n';
                    cells.forEach(cell => {
                        tableHTML += `<td style="border: 1px solid #e5e7eb; padding: 12px;">${cell}</td>\n`;
                    });
                    tableHTML += '</tr>\n';
                }
            }
            tableHTML += '</tbody>\n</table>\n';
            
            return tableHTML;
        });
    }

    // 마크다운 파일 로드 - 정적 import 방식으로 변경
    async loadMarkdownFile(fileName) {
        if (this.cache.has(fileName)) {
            return this.cache.get(fileName);
        }

        try {
            // 정적 import 매핑을 사용하여 마크다운 파일 로드
            const markdownData = await this.getStaticMarkdownContent(fileName);
            
            if (!markdownData) {
                console.error('마크다운 파일을 찾을 수 없습니다:', fileName);
                return null;
            }
            
            const parsed = this.parseFrontmatter(markdownData);
            
            const result = {
                ...parsed.frontmatter,
                content: parsed.content,
                renderedContent: this.parseMarkdown(parsed.content),
                fileName: fileName
            };

            this.cache.set(fileName, result);
            return result;
        } catch (error) {
            console.error('마크다운 파일 로드 실패:', fileName, error);
            return null;
        }
    }

    // fetch API를 사용한 마크다운 컨텐츠 로드
    async getStaticMarkdownContent(fileName) {
        try {
            // src 폴더의 마크다운 파일을 직접 fetch로 가져오기
            const response = await fetch(`/src/views/pages/landingpage/mainPage/tutorial/tutoria-contents/${fileName}`);
            
            if (!response.ok) {
                console.error(`파일을 찾을 수 없습니다: ${fileName} (${response.status})`);
                return null;
            }
            
            const content = await response.text();
            return content;
        } catch (error) {
            console.error('fetch 실패:', fileName, error);
            return null;
        }
    }

    // 튜토리얼 라우트 구조 정의
    getTutorialRoutes() {
        return {
            name: 'process-gpt',
            sections: [
                {
                    title: '시작하기',
                    items: [
                        {
                            path: '/process-gpt/',
                            title: 'Process GPT 소개',
                            markdownFile: 'index.md'
                        }
                    ]
                },
                {
                    title: '가이드',
                    items: [
                        {
                            path: '/process-gpt/admin-guide/',
                            title: '관리자 가이드',
                            markdownFile: 'admin-guide.md'
                        },
                        {
                            path: '/process-gpt/user-guide/',
                            title: '사용자 가이드',
                            markdownFile: 'user-guide.md'
                        },
                        {
                            path: '/process-gpt/ai-chat-guide/',
                            title: 'AI 채팅 가이드',
                            markdownFile: 'ai-chat-guide.md'
                        }
                    ]
                },
                {
                    title: 'AI를 활용한 프로세스 관리',
                    items: [
                        {
                            path: '/process-gpt/agent-knowledge/',
                            title: '에이전트 지식 관리',
                            markdownFile: 'agent-knowledge.md'
                        },
                        {
                            path: '/process-gpt/multi-agent/',
                            title: '멀티 에이전트',
                            markdownFile: 'multi-agent.md'
                        },
                        {
                            path: '/process-gpt/a2a-system/',
                            title: 'A2A 시스템',
                            markdownFile: 'a2a-system.md'
                        },
                        {
                            path: '/process-gpt/voice-chat/',
                            title: '음성 채팅',
                            markdownFile: 'voice-chat.md'
                        },
                        {
                            path: '/process-gpt/browser-use/',
                            title: '브라우저 사용',
                            markdownFile: 'browser-use.md'
                        },
                        {
                            path: '/process-gpt/process-marketplace/',
                            title: '프로세스 마켓플레이스',
                            markdownFile: 'process-marketplace.md'
                        },
                        {
                            path: '/process-gpt/simulation/',
                            title: '시뮬레이션',
                            markdownFile: 'simulation.md'
                        }
                    ]
                }
            ]
        };
    }

    // 라우트 구조 기반으로 메타데이터 가져오기
    async getAllMarkdownMetadata() {
        const routes = this.getTutorialRoutes();
        const metadata = [];

        for (const section of routes.sections) {
            for (let i = 0; i < section.items.length; i++) {
                const item = section.items[i];
                
                metadata.push({
                    fileName: item.markdownFile,
                    title: item.title,  // 라우트 구조의 title만 사용
                    section: section.title,
                    path: item.path.replace('/process-gpt/', '').replace('/', '') || 'index',
                    order: i + 1,
                    markdownFile: item.markdownFile
                });
            }
        }
        return metadata;
    }

    // 파일명에서 제목 자동 생성
    generateTitleFromFileName(fileName) {
        return fileName
            .replace('.md', '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // 섹션별로 그룹화
    async getGroupedMetadata() {
        const metadata = await this.getAllMarkdownMetadata();
        const grouped = {};

        metadata.forEach(item => {
            if (!grouped[item.section]) {
                grouped[item.section] = [];
            }
            grouped[item.section].push(item);
        });

        return grouped;
    }
}

export default new MarkdownLoader();