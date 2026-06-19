// CẤU HÌNH NGÂN HÀNG ĐÍCH
const BANK_BIN = "VBA"; 
const BANK_ACCOUNT = "3900205361940"; 

const firebaseConfig = {
    apiKey: "AIzaSyAOSKLNPXp-s40iJNYYzdEWDnQDFoa6x_Q",
    authDomain: "thue2026-f558d.firebaseapp.com",
    databaseURL: "https://thue2026-f558d-default-rtdb.firebaseio.com",
    projectId: "thue2026-f558d",
    storageBucket: "thue2026-f558d.firebasestorage.app",
    messagingSenderId: "1008017359572",
    appId: "1:1008017359572:web:f70cf40778e600e8deb141"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let allData = [];
let filteredData = []; 
let currentSelectedCustomerId = null; 
let isUpdatingToggle = false; // Ngăn chặn trigger lặp vòng khi set checked bằng code

let currentUser = JSON.parse(sessionStorage.getItem('customUser')) || null;

let currentPage = 1;
const rowsPerPage = 10;
let hasSearched = false; // Yêu cầu 2: Ban đầu chưa bấm tìm kiếm thì chưa load dữ liệu

window.onload = function() {
    checkLoginStatus();
};

function checkLoginStatus() {
    const loginWrapper = document.getElementById('loginWrapper');
    const mainSection = document.getElementById('mainSection');
    const qrPopup = document.getElementById('qrPopup');
    
    if (currentUser) {
        if (loginWrapper) loginWrapper.classList.add('hidden'); 
        if (mainSection) mainSection.classList.remove('hidden'); 
        document.getElementById('txtLoginUser').innerText = `👤 ${currentUser.username} (${currentUser.Branch})`;
        fetchTaxData(); 
    } else {
        if (loginWrapper) loginWrapper.classList.remove('hidden'); 
        if (mainSection) mainSection.classList.add('hidden'); 
        if (qrPopup) qrPopup.classList.add('hidden'); 
    }
}

function loginWithUsernamePassword() {
    const userInp = document.getElementById('loginUsername').value.trim();
    const passInp = document.getElementById('loginPassword').value.trim();

    if (!userInp || !passInp) {
        alert("Vui lòng nhập đầy đủ Tài khoản và Mật khẩu!");
        return;
    }

    db.ref('users/' + userInp).once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.password === passInp) {
            currentUser = {
                username: userData.username,
                Branch: userData.Branch
            };
            sessionStorage.setItem('customUser', JSON.stringify(currentUser));
            checkLoginStatus();
        } else {
            alert("Sai tài khoản hoặc mật khẩu. Vui lòng thử lại!");
        }
    }).catch(err => {
        alert("Lỗi kết nối cơ sở dữ liệu: " + err.message);
    });
}

function logout() {
    sessionStorage.removeItem('customUser');
    currentUser = null;
    location.reload();
}

function fetchTaxData() {
    if (!currentUser || !currentUser.Branch) return;

    db.ref('QRCodeTax').on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            allData = [];
            if (data) {
                for (let id in data) {
                    let item = data[id];
                    if (!item.ID) item.ID = id; 
                    
                    if (item.BranchCode === currentUser.Branch || item.Branch === currentUser.Branch) {
                        allData.push(item);
                    }
                }
                allData.sort((a, b) => new Date(b.InsertTime) - new Date(a.InsertTime));
            }
            initComboboxes();
            
            // Nếu đã bấm Tìm kiếm trước đó thì cập nhật lại bảng theo Realtime
            if (hasSearched) {
                searchData(true); 
            }
        } catch (error) {
            console.error(error);
        }
    });
}

function initComboboxes() {
    const phuongXaSelect = document.getElementById('filterPhuongXa');
    const currentPx = phuongXaSelect.value;
    const uniquePhuongXa = [...new Set(allData.map(item => item.PhuongXa).filter(Boolean))];
    
    phuongXaSelect.innerHTML = '<option value="">-- Tất cả Phường/Xã --</option>';
    uniquePhuongXa.forEach(px => {
        phuongXaSelect.innerHTML += `<option value="${px}">${px}</option>`;
    });
    if(uniquePhuongXa.includes(currentPx)) phuongXaSelect.value = currentPx;
    updateThonToCombobox();
}

function updateThonToCombobox() {
    const selectedPx = document.getElementById('filterPhuongXa').value;
    const thonToSelect = document.getElementById('filterThonTo');
    const currentTt = thonToSelect.value;
    
    const filteredItems = selectedPx ? allData.filter(item => item.PhuongXa === selectedPx) : allData;
    const uniqueThonTo = [...new Set(filteredItems.map(item => item.ThonTo).filter(Boolean))];

    thonToSelect.innerHTML = '<option value="">-- Tất cả Thôn/Tổ --</option>';
    uniqueThonTo.forEach(tt => {
        thonToSelect.innerHTML += `<option value="${tt}">${tt}</option>`;
    });
    if(uniqueThonTo.includes(currentTt)) thonToSelect.value = currentTt;
}

// ==========================================================================
// HÀM TÌM KIẾM DỮ LIỆU CHÍNH XÁC & TÌM GẦN ĐÚNG (MỚI KHẮC PHỤC)
// ==========================================================================
function searchData(isRealtimeUpdate = false) {
    if(!isRealtimeUpdate) {
        hasSearched = true; // Xác nhận người dùng đã chủ động bấm nút Tìm kiếm
    }

    const pxValue = document.getElementById('filterPhuongXa').value;
    const ttValue = document.getElementById('filterThonTo').value;
    const statusValue = document.getElementById('filterTrangThai').value; 
    
    // Lấy chuỗi tìm kiếm từ ô nhập tên, chuyển về chữ thường và chuẩn hóa loại bỏ dấu tiếng Việt
    const nameInp = document.getElementById('searchName').value.trim();
    const nameValueClean = removeVietnameseTones(nameInp.toLowerCase()); 

    filteredData = allData;

    // 1. Lọc theo Phường Xã
    if (pxValue) filteredData = filteredData.filter(item => item.PhuongXa === pxValue);
    
    // 2. Lọc theo Thôn Tổ
    if (ttValue) filteredData = filteredData.filter(item => item.ThonTo === ttValue);
    
    // 3. Lọc theo Trạng thái thanh toán
    if (statusValue !== "") {
        const isPaid = statusValue === "true";
        filteredData = filteredData.filter(item => {
            const itemStatus = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1 || item.DaThanhToan === "1";
            return itemStatus === isPaid;
        });
    }

    // 4. Lọc TÌM KIẾM GẦN ĐÚNG theo Họ và Tên (Đã sửa lỗi)
    if (nameValueClean) {
        filteredData = filteredData.filter(item => {
            // Ghép họ và tên đầy đủ từ DB
            const rawFullName = `${item.Ho || ''} ${item.Ten || ''}`;
            // Chuyển họ tên đầy đủ về chữ thường và xóa sạch dấu tiếng Việt
            const itemFullNameClean = removeVietnameseTones(rawFullName.toLowerCase());
            
            // Kiểm tra chuỗi tìm kiếm có nằm trong tên của khách hàng hay không (Gần đúng)
            return itemFullNameClean.indexOf(nameValueClean) !== -1;
        });
    }

    if(!isRealtimeUpdate) {
        currentPage = 1; 
    }
    renderTable();
}

// ==========================================================================
// HÀM CHUẨN HÓA XÓA DẤU TIẾNG VIỆT TOÀN DIỆN (ĐÃ TỐI ƯU CỰC MẠNH)
// ==========================================================================
function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    
    // Loại bỏ các ký tự dấu tổ hợp (Combining Diacritical Marks) trong unicode nếu có
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return str;
}

function renderTable() {
    const tbody = document.getElementById('taxTableBody');
    tbody.innerHTML = "";

    if (!hasSearched) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: #64748b;">Vui lòng bấm nút "Tìm kiếm" để tải dữ liệu</td></tr>`;
        updatePaginationControls(0);
        return;
    }

    if (!filteredData || filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Không tìm thấy dữ liệu phù hợp với địa bàn của bạn</td></tr>`;
        updatePaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // Tính tổng tiền theo IDSUM toàn cục hoặc cục bộ để hiển thị chính xác
    let idsumTotals = {};
    allData.forEach(item => {
        if(item.IDSUM) {
            const amt = Number(item.SoTienThuThue) || 0;
            idsumTotals[item.IDSUM] = (idsumTotals[item.IDSUM] || 0) + amt;
        }
    });

    // Thuật toán đếm số lần xuất hiện của IDSUM trong trang hiện tại để tạo Merge (rowspan)
    let idsumCountsInPage = {};
    let idsumRendered = {};

    pageData.forEach(item => {
        if (item.IDSUM) {
            idsumCountsInPage[item.IDSUM] = (idsumCountsInPage[item.IDSUM] || 0) + 1;
        }
    });

    pageData.forEach(item => {
        const tr = document.createElement('tr');
        
        const isPaid = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1 || item.DaThanhToan === "1";
        const statusText = isPaid
            ? "<b style='color:#10b981;'>Đã thanh toán</b>" 
            : "<b style='color:#ef4444;'>Chưa thanh toán</b>";
        
        // Cột 1: Mã số thuế
        tr.innerHTML += `<td>${item.MaSoThue || ''}</td>`;
        
        // Yêu cầu 3: Gộp ô (Merge) Họ và tên có cùng IDSUM
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRendered[item.IDSUM]) {
                tr.innerHTML += `<td rowspan="${idsumCountsInPage[item.IDSUM]}" style="vertical-align: middle; background-color: #fdfdfd; font-weight: 600;">${item.Ho || ''} ${item.Ten || ''}</td>`;
            }
        } else {
            tr.innerHTML += `<td>${item.Ho || ''} ${item.Ten || ''}</td>`;
        }

        // Cột hiển thị mới bổ sung từ DB SQL
        tr.innerHTML += `<td>${item.CCCD || ''}</td>`;
        tr.innerHTML += `<td>${item.ThonTo || ''}</td>`;
        tr.innerHTML += `<td>${item.PhuongXa || ''}</td>`;
        tr.innerHTML += `<td>${item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0} đ</td>`;

        // Yêu cầu 3: Thêm một cột tổng tiền ở cuối dòng (Gộp nhóm theo IDSUM)
        const totalGroupAmount = idsumTotals[item.IDSUM] || Number(item.SoTienThuThue) || 0;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRendered[item.IDSUM]) {
                tr.innerHTML += `<td rowspan="${idsumCountsInPage[item.IDSUM]}" style="vertical-align: middle; background-color: #f8fafc; font-weight: bold; color: #1e3a8a;">${totalGroupAmount.toLocaleString('vi-VN')} đ</td>`;
                idsumRendered[item.IDSUM] = true; // Đánh dấu đã render ô gộp
            }
        } else {
            tr.innerHTML += `<td style="font-weight: bold; color: #1e3a8a;">${totalGroupAmount.toLocaleString('vi-VN')} đ</td>`;
        }

        // Trạng thái và nút Hành động tạo QR
        tr.innerHTML += `<td>${statusText}</td>`;
        tr.innerHTML += `<td><button class="btn-table-qr" onclick="openQrPopup('${item.ID}')">⚙ Quét QR Thanh toán</button></td>`;
        
        tbody.appendChild(tr);
    });

    updatePaginationControls(filteredData.length);
}

function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    document.getElementById('pageInfo').innerText = `Trang ${currentPage} / ${totalPages}`;
    document.getElementById('btnPrev').disabled = (currentPage === 1);
    document.getElementById('btnNext').disabled = (currentPage === totalPages);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// Yêu cầu 4, 5 & 7: Cho phép mở QR kể cả khi đã hoặc chưa thanh toán
function openQrPopup(id) {
    const item = allData.find(x => x.ID === id);
    if (!item) return;

    currentSelectedCustomerId = id;
    
    // Đồng bộ trạng thái vào nút gạt ON-OFF
    const isPaid = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1 || item.DaThanhToan === "1";
    
    isUpdatingToggle = true; 
    document.getElementById('switchPaymentStatus').checked = isPaid;
    document.getElementById('toggleStatusLabel').innerText = isPaid ? "ON (Đã Đóng)" : "OFF (Chưa Đóng)";
    document.getElementById('toggleStatusLabel').style.color = isPaid ? "#10b981" : "#ef4444";
    isUpdatingToggle = false;

    // Yêu cầu 5: Nội dung chuyển khoản: "IDSUM + Số CCCD + thue dat" (Không dấu)
    const rawPurpose = `${item.IDSUM || ''} ${item.CCCD || ''} thue dat`;
    const purpose = removeVietnameseTones(rawPurpose);

    const qrUrl = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-qr_only.png?amount=${item.SoTienThuThue}&addInfo=${encodeURIComponent(purpose)}`;

    // Hiển thị CCCD, Họ tên, số tiền lên thông tin
    document.getElementById('qrInfo').innerHTML = `
        <b>Họ và tên:</b> ${item.Ho || ''} ${item.Ten || ''}<br>
        <b>Số CCCD:</b> ${item.CCCD || ''}<br>
        <b>Mã Số Thuế:</b> ${item.MaSoThue || ''}<br>
        <b>Số tiền dòng này:</b> ${item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0} đ<br>
        <b>Nội dung chuyển khoản:</b> <span style="color:#c2410c; font-weight:bold;">${purpose}</span>
    `;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrPopup').classList.remove('hidden');
}

// Yêu cầu 6 & 7: Khi thay đổi nút gạt ON/OFF sẽ cập nhật trực tiếp lên Firebase
function verifyAndPayChange(toggleElement) {
    if (isUpdatingToggle || !currentSelectedCustomerId) return;

    const isChecked = toggleElement.checked;
    const statusMsg = isChecked ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN";
    
    if(confirm(`Bạn muốn chuyển trạng thái khách hàng này thành: ${statusMsg}?`)) {
        db.ref('QRCodeTax/' + currentSelectedCustomerId).update({
            DaThanhToan: isChecked
        }).then(() => {
            document.getElementById('toggleStatusLabel').innerText = isChecked ? "ON (Đã Đóng)" : "OFF (Chưa Đóng)";
            document.getElementById('toggleStatusLabel').style.color = isChecked ? "#10b981" : "#ef4444";
            alert("Cập nhật trạng thái thành công!");
        }).catch((error) => {
            alert("Lỗi cập nhật dữ liệu: " + error.message);
            // Quay ngược lại nếu lỗi
            isUpdatingToggle = true;
            toggleElement.checked = !isChecked;
            isUpdatingToggle = false;
        });
    } else {
        // Quay ngược lại trạng thái cũ nếu huỷ bỏ confirm
        isUpdatingToggle = true;
        toggleElement.checked = !isChecked;
        isUpdatingToggle = false;
    }
}

function closePopup() {
    document.getElementById('qrPopup').classList.add('hidden');
    currentSelectedCustomerId = null; 
}

// function removeVietnameseTones(str) {
//     if (!str) return "";
//     str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
//     str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ẽ/g, "e");
//     str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
//     str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
//     str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
//     str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
//     str = str.replace(/đ/g, "d");
//     str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
//     str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|ể|Ẽ/g, "E");
//     str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
//     str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
//     str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
//     str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
//     str = str.replace(/Đ/g, "D");
//     return str.trim();
// }
