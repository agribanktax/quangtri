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
let currentSelectedIdSum = null; // Thay đổi: Lưu IDSUM được chọn thay vì ID đơn lẻ
let isUpdatingToggle = false; 

let currentUser = JSON.parse(sessionStorage.getItem('customUser')) || null;

let currentPage = 1;
const rowsPerPage = 10;
let hasSearched = false; 

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

function searchData(isRealtimeUpdate = false) {
    if(!isRealtimeUpdate) {
        hasSearched = true; 
    }

    const pxValue = document.getElementById('filterPhuongXa').value;
    const ttValue = document.getElementById('filterThonTo').value;
    const statusValue = document.getElementById('filterTrangThai').value; 
    
    const nameInp = document.getElementById('searchName').value.trim();
    const nameValueClean = removeVietnameseTones(nameInp.toLowerCase()); 

    filteredData = allData;

    if (pxValue) filteredData = filteredData.filter(item => item.PhuongXa === pxValue);
    if (ttValue) filteredData = filteredData.filter(item => item.ThonTo === ttValue);
    
    if (statusValue !== "") {
        const isPaid = statusValue === "true";
        filteredData = filteredData.filter(item => {
            const itemStatus = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1 || item.DaThanhToan === "1";
            return itemStatus === isPaid;
        });
    }

    if (nameValueClean) {
        filteredData = filteredData.filter(item => {
            const rawFullName = `${item.Ho || ''} ${item.Ten || ''}`;
            const itemFullNameClean = removeVietnameseTones(rawFullName.toLowerCase());
            return itemFullNameClean.indexOf(nameValueClean) !== -1;
        });
    }

    if(!isRealtimeUpdate) {
        currentPage = 1; 
    }
    renderTable();
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

    // Tính tổng tiền theo IDSUM toàn cục
    let idsumTotals = {};
    allData.forEach(item => {
        if(item.IDSUM) {
            const amt = Number(item.SoTienThuThue) || 0;
            idsumTotals[item.IDSUM] = (idsumTotals[item.IDSUM] || 0) + amt;
        }
    });

    // Đếm số lượng IDSUM trong trang hiện tại để thực hiện Rowspan gộp ô hiển thị
    let idsumCountsInPage = {};
    let idsumRenderedName = {};
    let idsumRenderedTotal = {};
    let idsumRenderedAction = {};

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
        
        // Cột 2: Họ và tên (Gộp ô nếu chung IDSUM)
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedName[item.IDSUM]) {
                tr.innerHTML += `<td rowspan="${idsumCountsInPage[item.IDSUM]}" style="vertical-align: middle; background-color: #fdfdfd; font-weight: 600;">${item.Ho || ''} ${item.Ten || ''}</td>`;
                idsumRenderedName[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += `<td>${item.Ho || ''} ${item.Ten || ''}</td>`;
        }

        tr.innerHTML += `<td>${item.CCCD || ''}</td>`;
        tr.innerHTML += `<td>${item.ThonTo || ''}</td>`;
        tr.innerHTML += `<td>${item.PhuongXa || ''}</td>`;
        tr.innerHTML += `<td>${item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0} đ</td>`;

        // Cột 7: Tổng tiền thanh toán (Gộp ô nhóm theo IDSUM)
        const totalGroupAmount = idsumTotals[item.IDSUM] || Number(item.SoTienThuThue) || 0;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedTotal[item.IDSUM]) {
                tr.innerHTML += `<td rowspan="${idsumCountsInPage[item.IDSUM]}" style="vertical-align: middle; background-color: #f8fafc; font-weight: bold; color: #1e3a8a;">${totalGroupAmount.toLocaleString('vi-VN')} đ</td>`;
                idsumRenderedTotal[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += `<td style="font-weight: bold; color: #1e3a8a;">${totalGroupAmount.toLocaleString('vi-VN')} đ</td>`;
        }

        // Cột 8: Trạng thái dòng đơn lẻ
        tr.innerHTML += `<td>${statusText}</td>`;
        
        // Cột 9: Hành động - SỬA ĐỔI: Gộp nút quét QR thanh toán theo IDSUM chung
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedAction[item.IDSUM]) {
                tr.innerHTML += `<td rowspan="${idsumCountsInPage[item.IDSUM]}" style="vertical-align: middle; text-align: center; background-color: #fdfdfd;">
                    <button class="btn-table-qr" onclick="openQrPopupByIdSum('${item.IDSUM}')">⚙ Quét QR Tổng</button>
                </td>`;
                idsumRenderedAction[item.IDSUM] = true;
            }
        } else {
            // Trường hợp IDSUM chỉ xuất hiện 1 dòng đơn lẻ
            tr.innerHTML += `<td style="text-align: center;">
                <button class="btn-table-qr" onclick="openQrPopupByIdSum('${item.IDSUM || item.ID}')">⚙ Quét QR</button>
            </td>`;
        }
        
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

// SỬA ĐỔI MỚI: Mở QR Popup dựa trên IDSUM nhóm để tính tổng tiền chung
function openQrPopupByIdSum(idsum) {
    if (!idsum) return;

    // Lọc ra toàn bộ danh sách các dòng có chung IDSUM này
    const groupRecords = allData.filter(x => x.IDSUM === idsum || x.ID === idsum);
    if (groupRecords.length === 0) return;

    // Lấy thông tin đại diện từ dòng đầu tiên để hiển thị thông tin tĩnh
    const baseItem = groupRecords[0];
    currentSelectedIdSum = idsum; 

    // Kiểm tra trạng thái chung: Nếu TẤT CẢ các dòng trong nhóm đều đã đóng thì nút gạt là ON, ngược lại là OFF
    const isAllPaid = groupRecords.every(item => item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1 || item.DaThanhToan === "1");

    isUpdatingToggle = true; 
    document.getElementById('switchPaymentStatus').checked = isAllPaid;
    document.getElementById('toggleStatusLabel').innerText = isAllPaid ? "ON (Đã Đóng)" : "OFF (Chưa Đóng)";
    document.getElementById('toggleStatusLabel').style.color = isAllPaid ? "#10b981" : "#ef4444";
    isUpdatingToggle = false;

    // Tính tổng số tiền thực tế của toàn bộ các hóa đơn thuộc IDSUM này để gán vào QR
    let totalAmount = 0;
    groupRecords.forEach(r => {
        totalAmount += (Number(r.SoTienThuThue) || 0);
    });

    // Nội dung chuyển khoản theo chuẩn: "IDSUM + Số CCCD + thue dat"
    const rawPurpose = `${baseItem.IDSUM || ''} ${baseItem.CCCD || ''} thue dat`;
    const purpose = removeVietnameseTones(rawPurpose);

    // Tạo liên kết VietQR tự động điền Tổng Số Tiền của cả nhóm hóa đơn
    const qrUrl = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-qr_only.png?amount=${totalAmount}&addInfo=${encodeURIComponent(purpose)}`;

    // Cập nhật giao diện Popup
    document.getElementById('qrInfo').innerHTML = `
        <b>Họ và tên:</b> ${baseItem.Ho || ''} ${baseItem.Ten || ''}<br>
        <b>Số CCCD:</b> ${baseItem.CCCD || ''}<br>
        <b>Mã Số Thuế:</b> ${baseItem.MaSoThue || ''}<br>
        <b>Số hóa đơn gộp:</b> <span style="font-weight:bold; color:#1e3a8a;">${groupRecords.length} dòng</span><br>
        <b>Tổng tiền thanh toán:</b> <span style="color:#1e3a8a; font-weight:bold;">${totalAmount.toLocaleString('vi-VN')} đ</span><br>
        <b>Nội dung chuyển khoản:</b> <span style="color:#c2410c; font-weight:bold;">${purpose}</span>
    `;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrPopup').classList.remove('hidden');
}

// SỬA ĐỔI MỚI: Đồng bộ trạng thái ON-OFF đồng loạt cho các dòng cùng IDSUM lên Firebase
function verifyAndPayChange(toggleElement) {
    if (isUpdatingToggle || !currentSelectedIdSum) return;

    const isChecked = toggleElement.checked;
    const statusMsg = isChecked ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN";
    
    if(confirm(`Bạn muốn chuyển trạng thái ĐỒNG LOẠT cho toàn bộ dòng có cùng IDSUM sang: ${statusMsg}?`)) {
        
        // Tìm toàn bộ các bản ghi thuộc IDSUM này trên bộ nhớ cục bộ
        const groupRecords = allData.filter(x => x.IDSUM === currentSelectedIdSum || x.ID === currentSelectedIdSum);
        
        let updatePromises = [];

        // Đẩy lệnh cập nhật trạng thái lên Firebase Realtime cho từng phần tử một
        groupRecords.forEach(item => {
            let p = db.ref('QRCodeTax/' + item.ID).update({
                DaThanhToan: isChecked
            });
            updatePromises.push(p);
        });

        // Đợi tất cả tiến trình cập nhật hoàn thành
        Promise.all(updatePromises).then(() => {
            document.getElementById('toggleStatusLabel').innerText = isChecked ? "ON (Đã Đóng)" : "OFF (Chưa Đóng)";
            document.getElementById('toggleStatusLabel').style.color = isChecked ? "#10b981" : "#ef4444";
            alert(`Đã cập nhật trạng thái ${statusMsg} thành công cho toàn bộ dòng dữ liệu!`);
        }).catch((error) => {
            alert("Lỗi cập nhật dữ liệu hàng loạt: " + error.message);
            isUpdatingToggle = true;
            toggleElement.checked = !isChecked;
            isUpdatingToggle = false;
        });

    } else {
        isUpdatingToggle = true;
        toggleElement.checked = !isChecked;
        isUpdatingToggle = false;
    }
}

function closePopup() {
    document.getElementById('qrPopup').classList.add('hidden');
    currentSelectedIdSum = null; 
}

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
    
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return str.trim();
}
