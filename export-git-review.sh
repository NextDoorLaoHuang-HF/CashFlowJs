#!/usr/bin/env bash
set -euo pipefail

# export-git-review.sh
# 将当前 git 仓库的未提交更改及所有受控文件导出为单一文本，方便外部专家审阅

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: 当前目录不是一个 git 仓库。" >&2
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 固定输出目录，内置 .gitignore 防止污染仓库
OUTPUT_DIR="${REPO_ROOT}/git-review-exports"
mkdir -p "$OUTPUT_DIR"
if [[ ! -f "${OUTPUT_DIR}/.gitignore" ]]; then
  echo "*" > "${OUTPUT_DIR}/.gitignore"
fi

OUTPUT_FILE="${OUTPUT_DIR}/${REPO_NAME}_git_review_${TIMESTAMP}.md"

echo "正在导出仓库信息到: $OUTPUT_FILE"

{
  echo "# 代码库审查导出"
  echo ""
  echo "- **仓库名称**: ${REPO_NAME}"
  echo "- **仓库路径**: ${REPO_ROOT}"
  echo "- **当前分支**: $(git branch --show-current 2>/dev/null || echo 'N/A')"
  echo "- **最新提交**: $(git log -1 --format='%H %s (%ci)' 2>/dev/null || echo 'N/A')"
  echo "- **导出时间**: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # ── 1. 未提交更改（diff）──
  echo "## 1. 未提交更改（git diff）"
  echo '```diff'
  if git diff --quiet && git diff --cached --quiet; then
    echo "（当前工作区干净，没有未提交的更改）"
  else
    # 包含工作区与暂存区的 diff
    git diff HEAD 2>/dev/null || true
  fi
  echo '```'
  echo ""

  # ── 2. 文件状态概览 ──
  echo "## 2. 文件状态概览（git status --short）"
  echo '```'
  git status --short 2>/dev/null || echo "（无法获取状态）"
  echo '```'
  echo ""

  # ── 3. 所有受控文件列表 ──
  echo "## 3. Git 管理的文件列表"
  echo ""
  FILE_LIST=$(git ls-files 2>/dev/null || true)
  if [[ -z "$FILE_LIST" ]]; then
    echo "（该仓库没有受控文件）"
  else
    echo '```'
    echo "$FILE_LIST"
    echo '```'
  fi
  echo ""

  # ── 4. 各文件内容 ──
  echo "## 4. 各文件内容"
  echo ""
  echo "> 以下按文件路径顺序列出所有受控文件的完整内容。"
  echo ""

  if [[ -z "$FILE_LIST" ]]; then
    echo "（无内容可导出）"
  else
    while IFS= read -r file; do
      # 跳过二进制文件与符号链接，避免垃圾输出
      if [[ -L "$REPO_ROOT/$file" ]]; then
        echo "### ${file}"
        echo '```'
        echo "（符号链接 -> $(readlink "$REPO_ROOT/$file")）"
        echo '```'
        echo ""
        continue
      fi

      mime_enc=$(file -b --mime-encoding "$REPO_ROOT/$file" 2>/dev/null || echo "")
      if [[ "$mime_enc" == "binary" ]]; then
        echo "### ${file}"
        echo '```'
        echo "（二进制文件，已跳过内容）"
        echo '```'
        echo ""
        continue
      fi

      echo "### ${file}"
      # 根据扩展名推断代码块语言，提升可读性
      ext="${file##*.}"
      lang=""
      case "$ext" in
        ts|tsx)   lang="typescript" ;;
        js|jsx)   lang="javascript" ;;
        py)       lang="python" ;;
        sh|bash)  lang="bash" ;;
        json)     lang="json" ;;
        yml|yaml) lang="yaml" ;;
        css)      lang="css" ;;
        html|htm) lang="html" ;;
        md)       lang="markdown" ;;
        sql)      lang="sql" ;;
        go)       lang="go" ;;
        rs)       lang="rust" ;;
        java)     lang="java" ;;
        c|h)      lang="c" ;;
        cpp|hpp)  lang="cpp" ;;
      esac

      echo "\`\`\`${lang}"
      cat "$REPO_ROOT/$file" || echo "（读取失败）"
      echo "\`\`\`"
      echo ""
    done <<< "$FILE_LIST"
  fi

  echo "---"
  echo "导出结束。"
} > "$OUTPUT_FILE"

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "导出完成: $OUTPUT_FILE (大小: $FILE_SIZE)"
