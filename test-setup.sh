#!/bin/bash

# AI Task Runner - 功能测试脚本

echo "==================================="
echo "  AI Task Runner 功能测试"
echo "==================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "测试: $test_name ... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}通过${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}失败${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "📁 检查项目结构..."
echo ""

# 检查核心文件
run_test "src/web-types.ts 存在" "[ -f src/web-types.ts ]"
run_test "src/task-executor.ts 存在" "[ -f src/task-executor.ts ]"
run_test "web/index.html 存在" "[ -f web/index.html ]"
run_test "web/assets/css/main.css 存在" "[ -f web/assets/css/main.css ]"
run_test "web/assets/js/main.js 存在" "[ -f web/assets/js/main.js ]"
run_test "web/assets/js/file-manager.js 存在" "[ -f web/assets/js/file-manager.js ]"
run_test "web/assets/js/git-manager.js 存在" "[ -f web/assets/js/git-manager.js ]"
run_test ".github/workflows/task-execution.yml 存在" "[ -f .github/workflows/task-execution.yml ]"
run_test ".github/workflows/status-monitor.yml 存在" "[ -f .github/workflows/status-monitor.yml ]"
run_test ".github/workflows/file-operations.yml 存在" "[ -f .github/workflows/file-operations.yml ]"
run_test ".github/workflows/git-integration.yml 存在" "[ -f .github/workflows/git-integration.yml ]"
run_test ".github/workflows/deploy-pages.yml 存在" "[ -f .github/workflows/deploy-pages.yml ]"

echo ""
echo "🔍 检查文件内容..."
echo ""

# 检查关键配置
run_test "package.json 包含 web 脚本" "grep -q 'serve:web' package.json"
run_test "tsconfig.json 存在" "[ -f tsconfig.json ]"
run_test "README.md 存在" "[ -f README.md ]"
run_test "WEB_README.md 存在" "[ -f WEB_README.md ]"
run_test "DEPLOYMENT_GUIDE.md 存在" "[ -f DEPLOYMENT_GUIDE.md ]"

echo ""
echo "🏗️ 检查TypeScript编译..."
echo ""

if [ -d "node_modules" ]; then
    run_test "TypeScript编译" "npm run build"
else
    echo -e "${YELLOW}跳过: node_modules 不存在，请先运行 npm install${NC}"
fi

echo ""
echo "✅ Web文件检查..."
echo ""

# 检查HTML结构
run_test "HTML包含聊天界面" "grep -q 'chat-messages' web/index.html"
run_test "HTML包含任务管理" "grep -q 'tasks-view' web/index.html"
run_test "HTML包含文件浏览器" "grep -q 'files-view' web/index.html"
run_test "HTML包含Git历史" "grep -q 'git-view' web/index.html"
run_test "HTML包含设置模态框" "grep -q 'modal-overlay' web/index.html"

# 检查CSS样式
run_test "CSS包含响应式样式" "grep -q '@media' web/assets/css/main.css"
run_test "CSS包含深色主题" "grep -q 'bg-dark' web/assets/css/main.css"

# 检查JavaScript模块
run_test "main.js 导入 FileManager" "grep -q 'from.*file-manager.js' web/assets/js/main.js"
run_test "main.js 导入 GitManager" "grep -q 'from.*git-manager.js' web/assets/js/main.js"
run_test "main.js 包含 TaskRunner 类" "grep -q 'class TaskRunner' web/assets/js/main.js"
run_test "file-manager.js 包含 FileManager 类" "grep -q 'class FileManager' web/assets/js/file-manager.js"
run_test "git-manager.js 包含 GitManager 类" "grep -q 'class GitManager' web/assets/js/git-manager.js"

echo ""
echo "📝 检查GitHub Actions工作流..."
echo ""

# 检查工作流文件
run_test "task-execution.yml 包含 workflow_dispatch" "grep -q 'workflow_dispatch:' .github/workflows/task-execution.yml"
run_test "status-monitor.yml 包含 workflow_dispatch" "grep -q 'workflow_dispatch:' .github/workflows/status-monitor.yml"
run_test "file-operations.yml 包含 workflow_dispatch" "grep -q 'workflow_dispatch:' .github/workflows/file-operations.yml"
run_test "git-integration.yml 包含 workflow_dispatch" "grep -q 'workflow_dispatch:' .github/workflows/git-integration.yml"
run_test "deploy-pages.yml 配置正确" "grep -q 'deploy-pages' .github/workflows/deploy-pages.yml"

echo ""
echo "📊 测试结果总结"
echo "==================================="
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"
echo "总计: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！项目已准备好部署。${NC}"
    echo ""
    echo "下一步:"
    echo "1. 运行 'npm install' 安装依赖"
    echo "2. 运行 'npm run serve:web' 本地测试"
    echo "3. 查看 DEPLOYMENT_GUIDE.md 了解部署步骤"
    exit 0
else
    echo -e "${RED}❌ 有 $TESTS_FAILED 个测试失败，请检查上述错误。${NC}"
    exit 1
fi