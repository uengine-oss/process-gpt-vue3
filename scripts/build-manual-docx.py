#!/usr/bin/env python3
"""통합 사용자 매뉴얼 docx 갱신 — docs/manuals/*.md 를 장(章)으로 추가한다.

사용: <venv>/bin/python scripts/build-manual-docx.py

기존 docx(제1~6부 23장)는 그대로 두고, CHAPTERS 에 정의된 md 매뉴얼을
제7~9부(24~36장)로 뒤에 붙인다. 표지의 부/장 수와 날짜, 목차 텍스트도 갱신한다.
재실행하면 이전에 붙인 제7부 이후를 제거하고 다시 붙는다(멱등).
"""
import copy
import datetime
import glob
import os
import re
import sys

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml.ns import qn
from docx.shared import Emu

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANUALS = os.path.join(REPO, 'docs', 'manuals')
# 파일명이 NFD(자소 분리)로 저장돼 있어 한글 리터럴 비교가 실패할 수 있다 → normalize 후 비교
import unicodedata
DOCX = [
    p for p in glob.glob(os.path.join(REPO, 'docs', '*.docx'))
    if '매뉴얼' in unicodedata.normalize('NFC', os.path.basename(p))
]
CONTENT_WIDTH = Emu(5943600)  # 기존 본문 이미지 폭과 동일

# (부 제목, [(md 파일, 장 제목)])  — 장 번호는 24장부터 순서대로 부여
PARTS = [
    ('제7부. 순서도 입력 심화', [
        ('raci-task-settings.md', '순서도 Task 상세 설정 — RACI와 세부 업무 수행 절차'),
        ('process-export.md', '프로세스 순서도 내보내기 (이미지 · BPMN · PDF)'),
        ('task-catalog.md', 'Task 카탈로그'),
        ('glossary.md', '용어 사전'),
    ]),
    ('제8부. 조직과 협업', [
        ('organization-chart.md', '조직도'),
        ('signup-approvals.md', '가입 및 권한 승인'),
        ('merge-requests.md', '병합 요청함과 병합 전 검증'),
        ('notifications-inbox.md', '알림과 내 수신함'),
    ]),
    ('제9부. 관리자 신규 기능', [
        ('option-lists.md', '목록 관리 (선택지 목록)'),
        ('security-settings.md', '보안 설정'),
        ('audit-trail.md', '감사 로그'),
        ('analysis-dashboard.md', '분석 대시보드'),
        ('process-restructure.md', '프로세스 구조 재구성'),
    ]),
]
FIRST_NEW_PART = '제7부.'
START_CHAPTER = 24


def find_docx():
    if not DOCX:
        sys.exit('docx 파일을 찾지 못했습니다')
    return DOCX[0]


# ---------- markdown 파싱 (이 레포 매뉴얼이 쓰는 부분집합만) ----------

def parse_md(path):
    """블록 리스트 반환: (kind, payload)
    kind: h2/h3/para/bullet/number/image/table/quote
    """
    lines = open(path, encoding='utf-8').read().splitlines()
    blocks, buf, table = [], [], []

    def flush_para():
        if buf:
            text = ' '.join(s.strip() for s in buf).strip()
            if text:
                blocks.append(('para', text))
            buf.clear()

    def flush_table():
        if table:
            rows = [[c.strip() for c in row.strip().strip('|').split('|')] for row in table]
            rows = [r for r in rows if not all(re.fullmatch(r':?-{2,}:?', c or '---') for c in r)]
            if rows:
                blocks.append(('table', rows))
            table.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith('|'):
            flush_para()
            table.append(s)
            i += 1
            continue
        flush_table()
        if not s or s == '---':
            flush_para()
        elif s.startswith('# '):
            flush_para()  # 문서 제목은 장 제목으로 대체하므로 버린다
        elif s.startswith('## '):
            flush_para(); blocks.append(('h2', s[3:].strip()))
        elif s.startswith('### '):
            flush_para(); blocks.append(('h3', s[4:].strip()))
        elif s.startswith('#### '):
            flush_para(); blocks.append(('h3', s[5:].strip()))
        elif s.startswith('> '):
            flush_para(); blocks.append(('quote', s[2:].strip()))
        elif re.match(r'^!\[[^\]]*\]\(([^)]+)\)', s):
            flush_para()
            m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)', s)
            blocks.append(('image', (m.group(1), m.group(2))))
        elif re.match(r'^[-*] ', s):
            flush_para(); blocks.append(('bullet', s[2:].strip()))
        elif re.match(r'^\d+[.)] ', s):
            flush_para(); blocks.append(('number', re.sub(r'^\d+[.)] ', '', s)))
        else:
            # 들여쓴 연속 줄(목록 이어짐 포함)은 직전 블록에 붙인다
            if re.match(r'^(\s{2,}|\t)', line) and blocks and blocks[-1][0] in ('bullet', 'number', 'quote'):
                kind, text = blocks[-1]
                m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)', s)
                if m:
                    blocks.append(('image', (m.group(1), m.group(2))))
                else:
                    blocks[-1] = (kind, text + ' ' + s)
            else:
                buf.append(s)
        i += 1
    flush_para(); flush_table()
    return blocks


# ---------- docx 조립 ----------

INLINE = re.compile(r'(\*\*.+?\*\*|`[^`]+`)')


def add_runs(paragraph, text):
    """**굵게** 는 bold run, `code` 는 백틱만 벗겨 일반 run 으로."""
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            paragraph.add_run(part[2:-2]).bold = True
        elif part.startswith('`') and part.endswith('`'):
            paragraph.add_run(part[1:-1])
        else:
            paragraph.add_run(part)


class Builder:
    def __init__(self, doc):
        self.doc = doc
        # 기존 Compact 목록 문단에서 numPr(번호 매김 참조)을 복제해 둔다
        self.bullet_numpr = None
        for p in doc.paragraphs:
            if p.style.name == 'Compact' and '<w:numPr>' in p._p.xml:
                ppr = p._p.find(qn('w:pPr'))
                self.bullet_numpr = copy.deepcopy(ppr.find(qn('w:numPr')))
                break

    def para(self, text, style):
        p = self.doc.add_paragraph(style=style)
        add_runs(p, text)
        return p

    def listed(self, text):
        p = self.doc.add_paragraph(style='Compact')
        if self.bullet_numpr is not None:
            p._p.get_or_add_pPr().append(copy.deepcopy(self.bullet_numpr))
        add_runs(p, text)
        return p

    def image(self, alt, rel_path):
        path = os.path.join(MANUALS, rel_path)
        if not os.path.exists(path):
            print(f'  ! 이미지 없음: {rel_path}')
            return
        p = self.doc.add_paragraph(style='First Paragraph')
        p.add_run().add_picture(path, width=CONTENT_WIDTH)
        if alt:
            cap = self.doc.add_paragraph(style='Body Text')
            cap.add_run(alt).italic = True

    def table(self, rows):
        cols = max(len(r) for r in rows)
        t = self.doc.add_table(rows=len(rows), cols=cols)
        try:
            t.style = self.doc.styles['Table']
        except KeyError:
            pass
        for ri, row in enumerate(rows):
            for ci in range(cols):
                cell = t.cell(ri, ci)
                text = row[ci] if ci < len(row) else ''
                cell.paragraphs[0].text = ''
                add_runs(cell.paragraphs[0], text)
                if ri == 0:
                    for r in cell.paragraphs[0].runs:
                        r.bold = True


def remove_previous_appendix(doc):
    """이전 실행이 붙인 제7부 이후를 제거한다(멱등 재실행용)."""
    body = doc.element.body
    start = None
    for p in doc.paragraphs:
        if p.style.name == 'Heading 1' and p.text.strip().startswith(FIRST_NEW_PART):
            start = p._p
            break
    if start is None:
        return False
    # start 이후의 형제 요소를 모두 제거 (sectPr 은 남긴다)
    node = start
    to_remove = []
    while node is not None:
        nxt = node.getnextsibling() if hasattr(node, 'getnextsibling') else node.getnext()
        if node.tag != qn('w:sectPr'):
            to_remove.append(node)
        node = nxt
    for n in to_remove:
        body.remove(n)
    return True


def update_cover_and_toc(doc, toc_entries, total_parts, total_chapters):
    today = datetime.date.today()
    for p in doc.paragraphs[:40]:
        t = p.text.strip()
        if re.fullmatch(r'전 \d+부 \d+장', t):
            for r in p.runs:
                r.text = ''
            p.runs[0].text = f'전 {total_parts}부 {total_chapters}장'
        elif re.fullmatch(r'20\d{2}년 \d{2}월 \d{2}일', t):
            for r in p.runs:
                r.text = ''
            p.runs[0].text = f'{today.year}년 {today.month:02d}월 {today.day:02d}일'

    # 목차: 마지막 기존 항목("23장. …") 뒤에 새 줄 추가 (이전 실행분은 먼저 제거)
    paras = doc.paragraphs
    last_toc = None
    style_part = style_chapter = None
    for p in paras[:120]:
        t = p.text.strip()
        if re.match(r'^제\d+부\.', t) and '\t' in p.text:
            style_part = p
        if re.match(r'^23장\.', t):
            last_toc = p
            style_chapter = p
        if re.match(r'^제[789]부\.', t) or re.match(r'^(2[4-9]|3[0-9])장\.', t):
            # 이전 실행이 넣은 목차 줄 제거
            p._p.getparent().remove(p._p)
    if last_toc is None:
        print('  ! 목차 기준 줄(23장)을 찾지 못해 목차는 갱신하지 않음')
        return
    anchor = last_toc._p
    for kind, text in toc_entries:
        src = (style_part if kind == 'part' else style_chapter) or last_toc
        new_p = copy.deepcopy(src._p)
        # 텍스트 교체: 첫 run 에 제목만 남기고 나머지 run 비움 (페이지 번호 없음)
        runs = new_p.findall(qn('w:r'))
        for i, r in enumerate(runs):
            for t_el in r.findall(qn('w:t')):
                t_el.text = text if i == 0 else ''
        anchor.addnext(new_p)
        anchor = new_p


def main():
    path = find_docx()
    doc = Document(path)
    removed = remove_previous_appendix(doc)
    if removed:
        print('이전에 추가한 제7부 이후를 제거하고 다시 생성합니다')

    b = Builder(doc)
    chapter_no = START_CHAPTER
    toc_entries = []

    # 새 부는 페이지를 나눠 시작
    for part_title, chapters in PARTS:
        brk = doc.add_paragraph(style='Body Text')
        brk.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph(part_title, style='Heading 1')
        toc_entries.append(('part', part_title))
        for md_file, chapter_title in chapters:
            full_title = f'{chapter_no}장. {chapter_title}'
            doc.add_paragraph(full_title, style='Heading 2')
            toc_entries.append(('chapter', full_title))
            print(f'+ {full_title}  ({md_file})')
            for kind, payload in parse_md(os.path.join(MANUALS, md_file)):
                if kind == 'h2':
                    b.para(payload, 'Heading 3')
                elif kind == 'h3':
                    b.para(payload, 'Heading 4')
                elif kind == 'para':
                    b.para(payload, 'First Paragraph')
                elif kind in ('bullet', 'number'):
                    b.listed(payload)
                elif kind == 'quote':
                    p = b.para(payload, 'Body Text')
                    for r in p.runs:
                        r.italic = True
                elif kind == 'image':
                    b.image(*payload)
                elif kind == 'table':
                    b.table(payload)
            chapter_no += 1

    total_chapters = chapter_no - 1
    update_cover_and_toc(doc, toc_entries, 6 + len(PARTS), total_chapters)
    doc.save(path)
    print(f'저장 완료: {path}  (전 {6 + len(PARTS)}부 {total_chapters}장)')


if __name__ == '__main__':
    main()
