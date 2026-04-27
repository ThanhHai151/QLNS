#!/bin/bash
# ============================================================
# COMPREHENSIVE API TEST - QLNS Distributed Backend
# ============================================================
BASE="http://localhost:4000/api"
PASS=0; FAIL=0; WARN=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

check() {
  local label="$1"; local url="$2"; local method="${3:-GET}"; local data="$4"; local expect_key="${5:-success}"
  if [ "$method" = "GET" ]; then
    resp=$(curl -s -w "\n%{http_code}" "$url")
  else
    resp=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
  fi
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  ok=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('$expect_key') else 'no')" 2>/dev/null)
  rows=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('totalRows','?'))" 2>/dev/null)
  err=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ "$ok" = "yes" ] && [ "$http_code" -lt 400 ]; then
    echo -e "  ${GREEN}✅ PASS${NC} [$http_code] $label ${CYAN}(rows=$rows)${NC}"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC} [$http_code] $label"
    echo -e "       ${RED}Error: $err${NC}"
    echo -e "       Body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

check_sql() {
  local label="$1"; local node="$2"; local sql="$3"
  resp=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" \
    -d "{\"sql\":$(echo "$sql" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"),\"node\":\"$node\"}" \
    "$BASE/query")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  ok=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('success') else 'no')" 2>/dev/null)
  rows=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('rowCount','?'))" 2>/dev/null)
  err=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ "$ok" = "yes" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} [$node] $label ${CYAN}(rows=$rows)${NC}"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC} [$node] $label"
    echo -e "       ${RED}SQL Error: $err${NC}"
    FAIL=$((FAIL+1))
  fi
}

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   KIỂM TRA TOÀN DIỆN API - QLNS PHÂN TÁN${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# ─── 1. HEALTH & NODES ──────────────────────────────────────
echo -e "\n${YELLOW}▶ [1] HEALTH & SYSTEM NODES${NC}"
check "Health check (all nodes)" "$BASE/health"
check "System nodes status" "$BASE/system/nodes"

# ─── 2. LOOKUP DATA ─────────────────────────────────────────
echo -e "\n${YELLOW}▶ [2] LOOKUP DATA (branches, positions, educations, departments)${NC}"
check "GET /lookup/branches" "$BASE/lookup/branches"
check "GET /lookup/positions" "$BASE/lookup/positions"
check "GET /lookup/educations" "$BASE/lookup/educations"
check "GET /lookup/departments" "$BASE/lookup/departments"

# ─── 3. EMPLOYEES - READ ────────────────────────────────────
echo -e "\n${YELLOW}▶ [3] EMPLOYEES - READ (phân tán tất cả branches)${NC}"
check "GET /employees (all branches)" "$BASE/employees"
check "GET /employees?branch=CN1" "$BASE/employees?branch=CN1"
check "GET /employees?branch=CN2" "$BASE/employees?branch=CN2"
check "GET /employees?branch=CN3" "$BASE/employees?branch=CN3"
check "GET /employees/NV001" "$BASE/employees/NV001"
check "GET /employees/NV999 (not found)" "$BASE/employees/NV999" "GET" "" "success"

# ─── 4. EMPLOYEES - CRUD ────────────────────────────────────
echo -e "\n${YELLOW}▶ [4] EMPLOYEES - CREATE / UPDATE / DELETE${NC}"
# Create
NV_ID="NVTEST$(date +%s)"
check "POST /employees (create CN1)" "$BASE/employees" "POST" \
  "{\"IDNV\":\"$NV_ID\",\"TENNV\":\"Test CURL\",\"GIOITINH\":\"Nam\",\"NGAYSINH\":\"2000-01-01\",\"EMAIL\":\"test@test.com\",\"DIENTHOAI\":\"0900000001\",\"DIACHI\":\"Hanoi\",\"DANTOC\":\"Kinh\",\"TONGIAO\":\"Không\",\"HONNHAN\":\"Độc thân\",\"TRINHDO\":\"TD001\",\"CHUCVU\":\"CV003\",\"PHONGBAN\":\"PB_KD1\",\"CHINHANH\":\"CN1\"}"

# Read back
check "GET /employees/$NV_ID (verify created)" "$BASE/employees/$NV_ID"

# Update
check "PUT /employees/$NV_ID (update)" "$BASE/employees/$NV_ID" "PUT" \
  "{\"DIENTHOAI\":\"0911999888\",\"DIACHI\":\"Updated Address\"}"

# Re-read after update  
check "GET /employees/$NV_ID (verify updated)" "$BASE/employees/$NV_ID"

# Delete (soft)
check "DELETE /employees/$NV_ID (soft delete)" "$BASE/employees/$NV_ID" "DELETE"

# ─── 5. SALARIES ────────────────────────────────────────────
echo -e "\n${YELLOW}▶ [5] SALARIES (bảng lương phân tán)${NC}"
check "GET /salaries (all)" "$BASE/salaries"
check "GET /salaries?branch=CN1" "$BASE/salaries?branch=CN1"
check "GET /salaries?branch=CN2" "$BASE/salaries?branch=CN2"
check "GET /salaries?branch=CN3" "$BASE/salaries?branch=CN3"
check "GET /salaries?thang=1&nam=2024" "$BASE/salaries?thang=1&nam=2024"

# ─── 6. ATTENDANCE ──────────────────────────────────────────
echo -e "\n${YELLOW}▶ [6] ATTENDANCE (chấm công phân tán)${NC}"
check "GET /attendance (all)" "$BASE/attendance"
check "GET /attendance?branch=CN1" "$BASE/attendance?branch=CN1"
check "GET /attendance?branch=CN2" "$BASE/attendance?branch=CN2"
check "GET /attendance?branch=CN3" "$BASE/attendance?branch=CN3"
check "GET /attendance?thang=1&nam=2024" "$BASE/attendance?thang=1&nam=2024"

# ─── 7. CONTRACTS ───────────────────────────────────────────
echo -e "\n${YELLOW}▶ [7] CONTRACTS (hợp đồng phân tán)${NC}"
check "GET /contracts (all)" "$BASE/contracts"
check "GET /contracts?branch=CN1" "$BASE/contracts?branch=CN1"
check "GET /contracts?branch=CN2" "$BASE/contracts?branch=CN2"
check "GET /contracts?branch=CN3" "$BASE/contracts?branch=CN3"

# ─── 8. RECRUITMENT ─────────────────────────────────────────
echo -e "\n${YELLOW}▶ [8] RECRUITMENT - CRUD${NC}"
check "GET /recruitment (all)" "$BASE/recruitment"
check "GET /recruitment?branch=CN1" "$BASE/recruitment?branch=CN1"

TD_ID="TDTEST$(date +%s)"
check "POST /recruitment (create)" "$BASE/recruitment" "POST" \
  "{\"MATD\":\"$TD_ID\",\"IDCN\":\"CN1\",\"VITRITD\":\"Test CURL\",\"DOTUOI\":25,\"GIOITINH\":\"Không\",\"SOLUONG\":2,\"HANTD\":\"2025-12-31\",\"LUONGTOITHIEU\":10000000,\"LUONGTOIDA\":20000000,\"TRANGTHAI\":\"Đang tuyển\"}"

check "PUT /recruitment/$TD_ID (update)" "$BASE/recruitment/$TD_ID" "PUT" \
  "{\"SOLUONG\":3,\"TRANGTHAI\":\"Đang tuyển\"}"

check "DELETE /recruitment/$TD_ID (soft delete)" "$BASE/recruitment/$TD_ID" "DELETE"

# ─── 9. REPORTS ─────────────────────────────────────────────
echo -e "\n${YELLOW}▶ [9] REPORTS (báo cáo phân tán)${NC}"
check "GET /reports/global (aggregate)" "$BASE/reports/global"

# ─── 10. SQL TERMINAL - DISTRIBUTED QUERIES ─────────────────
echo -e "\n${YELLOW}▶ [10] SQL TERMINAL - PHÂN TÁN TRÊN TẤT CẢ NODES${NC}"

echo -e "  ${CYAN}── Master node queries ──${NC}"
check_sql "SELECT NHANVIEN (master)" "master" "SELECT IDNV,TENNV,CHINHANH FROM NHANVIEN LIMIT 5"
check_sql "SELECT HOPDONG (master)" "master" "SELECT SODH,TRANGTHAI FROM HOPDONG LIMIT 5"
check_sql "SELECT BANGCHAMCONG (master)" "master" "SELECT IDBC,IDNV,THANG,NAM FROM BANGCHAMCONG LIMIT 5"
check_sql "SELECT BANGLUONG (master)" "master" "SELECT IDBL,THUCNHAN FROM BANGLUONG LIMIT 5"
check_sql "SELECT TUYENDUNG (master)" "master" "SELECT MATD,VITRITD,TRANGTHAI FROM TUYENDUNG LIMIT 5"
check_sql "SELECT CHUCVU (master)" "master" "SELECT * FROM CHUCVU"
check_sql "SELECT TRINHDO (master)" "master" "SELECT * FROM TRINHDO"
check_sql "SELECT PHONGBAN (master)" "master" "SELECT * FROM PHONGBAN"
check_sql "SELECT CHINHANH (master)" "master" "SELECT * FROM CHINHANH"
check_sql "JOIN NV+CV+PB+CN (master)" "master" "SELECT nv.TENNV,cv.TENCV,pb.TENPB FROM NHANVIEN nv JOIN CHUCVU cv ON nv.CHUCVU=cv.IDCV JOIN PHONGBAN pb ON nv.PHONGBAN=pb.IDPB LIMIT 5"
check_sql "GROUP BY CHINHANH count (master)" "master" "SELECT CHINHANH,COUNT(*) as cnt FROM NHANVIEN WHERE IsDeleted=0 OR IsDeleted IS NULL GROUP BY CHINHANH"
check_sql "PRAGMA table_info NHANVIEN" "master" "PRAGMA table_info('NHANVIEN')"

echo -e "  ${CYAN}── CN1 (Hà Nội) queries ──${NC}"
check_sql "SELECT NHANVIEN (cn1)" "cn1" "SELECT IDNV,TENNV,CHINHANH FROM NHANVIEN WHERE CHINHANH='CN1' LIMIT 5"
check_sql "JOIN BANGLUONG+BANGCHAMCONG+NHANVIEN (cn1)" "cn1" "SELECT n.TENNV,b.THUCNHAN FROM BANGLUONG b JOIN BANGCHAMCONG cc ON b.IDBC=cc.IDBC JOIN NHANVIEN n ON cc.IDNV=n.IDNV LIMIT 5"
check_sql "UPDATE NHANVIEN on cn1 (cross-node)" "cn1" "UPDATE NHANVIEN SET DIENTHOAI='0900111222' WHERE IDNV='NV001'"

echo -e "  ${CYAN}── CN2 (Đà Nẵng) queries ──${NC}"
check_sql "SELECT NHANVIEN (cn2)" "cn2" "SELECT IDNV,TENNV,CHINHANH FROM NHANVIEN WHERE CHINHANH='CN2' LIMIT 5"
check_sql "UPDATE NHANVIEN on cn2 (cross-node)" "cn2" "UPDATE NHANVIEN SET DIENTHOAI='0900222333' WHERE IDNV='NV002'"

echo -e "  ${CYAN}── CN3 (TP.HCM) queries ──${NC}"
check_sql "SELECT NHANVIEN (cn3)" "cn3" "SELECT IDNV,TENNV,CHINHANH FROM NHANVIEN WHERE CHINHANH='CN3' LIMIT 5"
check_sql "UPDATE NHANVIEN on cn3 (cross-node)" "cn3" "UPDATE NHANVIEN SET DIENTHOAI='0900333444' WHERE IDNV='NV003'"

echo -e "  ${CYAN}── Schema queries ──${NC}"
check_sql "sqlite_master list tables (master)" "master" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
check_sql "sqlite_master list tables (cn1)" "cn1" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# ─── 11. SCHEMA API ─────────────────────────────────────────
echo -e "\n${YELLOW}▶ [11] SCHEMA API (xem cấu trúc DB)${NC}"
check "GET /schema/master" "$BASE/schema/master"
check "GET /schema/cn1" "$BASE/schema/cn1"
check "GET /schema/cn2" "$BASE/schema/cn2"
check "GET /schema/cn3" "$BASE/schema/cn3"

# ─── 12. CROSS-NODE DATA SYNC VERIFY ────────────────────────
echo -e "\n${YELLOW}▶ [12] KIỂM TRA ĐỒNG BỘ DỮ LIỆU SAU UPDATE${NC}"
echo -e "  ${CYAN}── Verify NV001 phone updated on cn1 ──${NC}"
resp=$(curl -s "$BASE/employees/NV001")
phone=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('DIENTHOAI','?'))" 2>/dev/null)
echo -e "  ${CYAN}  NV001.DIENTHOAI = $phone${NC}"
# Then restore
curl -s -X PUT -H "Content-Type: application/json" \
  -d '{"DIENTHOAI":"0901112223"}' "$BASE/employees/NV001" > /dev/null
echo -e "  ${GREEN}↩️  NV001 phone restored${NC}"

# ─── SUMMARY ─────────────────────────────────────────────────
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   KẾT QUẢ KIỂM TRA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS+FAIL))
echo -e "  Tổng:   $TOTAL tests"
echo -e "  ${GREEN}✅ Passed: $PASS${NC}"
echo -e "  ${RED}❌ Failed: $FAIL${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "\n  ${GREEN}🎉 TẤT CẢ TESTS ĐỀU PASS! Backend hoạt động tốt.${NC}"
else
  echo -e "\n  ${RED}⚠️  CÓ $FAIL TEST THẤT BẠI. Xem chi tiết ở trên.${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
