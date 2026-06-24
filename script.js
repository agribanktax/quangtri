// CẤU HÌNH NGÂN HÀNG ĐÍCH
// LƯU Ý: Chuyển đổi mã chữ sang mã số BIN 6 số của Napas (VBA -> 970405) để API POST chạy được
const BANK_BIN = "970405"; // 970405 là mã định danh BIN của Agribank
//const BANK_ACCOUNT = "3902201013072"; 
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
let currentSelectedIdSum = null; 
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
        document.getElementById('txtLoginUser').innerText = "👤 " + currentUser.username + "&nbsp;";
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
                    
                    if (item.Branch === currentUser.Branch || item.BranchCode === currentUser.Branch) {
                        allData.push(item);
                    }
                }
                
                // Đồng bộ sắp xếp theo IDSUM để các dòng cùng IDSUM nằm cạnh nhau
                allData.sort((a, b) => {
                    if (a.IDSUM && b.IDSUM) {
                        if (a.IDSUM === b.IDSUM) {
                            return new Date(b.InsertTime) - new Date(a.InsertTime);
                        }
                        return a.IDSUM.localeCompare(b.IDSUM);
                    }
                    return new Date(b.InsertTime) - new Date(a.InsertTime);
                });
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
        phuongXaSelect.innerHTML += "<option value='" + px + "'>" + px + "</option>";
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
        thonToSelect.innerHTML += "<option value='" + tt + "'>" + tt + "</option>";
    });
    if(uniqueThonTo.includes(currentTt)) thonToSelect.value = currentTt;
}

function searchData(isRealtimeUpdate = false) {
    if (!isRealtimeUpdate) {
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
            const itemStatus = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1;
            return itemStatus === isPaid;
        });
    }

    // XỬ LÝ TÌM KIẾM GẦN ĐÚNG THEO TÊN
    if (nameValueClean) {
        filteredData = filteredData.filter(item => {
            const rawFullName = (item.Ho || '') + " " + (item.Ten || '');
            const itemFullNameClean = removeVietnameseTones(rawFullName.toLowerCase());
            return itemFullNameClean.indexOf(nameValueClean) !== -1;
        });
    }

    if (!isRealtimeUpdate) {
        currentPage = 1; 
    }
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('taxTableBody');
    tbody.innerHTML = "";

    if (!hasSearched) {
        tbody.innerHTML = "<tr><td colspan='10' style='text-align:center; color: #64748b; padding: 20px;'>Vui lòng nhập điều kiện lọc và bấm nút 'Tìm kiếm' để tải dữ liệu</td></tr>";
        updatePaginationControls(0);
        return;
    }

    if (!filteredData || filteredData.length === 0) {
        tbody.innerHTML = "<tr><td colspan='10' style='text-align:center; padding: 20px;'>Không tìm thấy dữ liệu phù hợp với địa bàn của bạn</td></tr>";
        updatePaginationControls(0);
        return;
    }

    // 1. Tính tổng tiền tích lũy theo IDSUM toàn cục
    let idsumTotals = {};
    allData.forEach(item => {
        if(item.IDSUM) {
            const amt = Number(item.SoTienThuThue) || 0;
            idsumTotals[item.IDSUM] = (idsumTotals[item.IDSUM] || 0) + amt;
        }
    });

    // 2. Phân trang dữ liệu
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // 3. Đếm số dòng xuất hiện của từng IDSUM trong trang hiện tại để tạo thuộc tính Rowspan
    let idsumCountsInPage = {};
    pageData.forEach(item => {
        if (item.IDSUM) {
            idsumCountsInPage[item.IDSUM] = (idsumCountsInPage[item.IDSUM] || 0) + 1;
        }
    });
    let idsumRenderedMST = {};
    let idsumRenderedName = {};
    let idsumRenderedCCCD = {};
    let idsumRenderedThonTo = {};
    let idsumRenderedPhuongXa = {};
    let idsumRenderedTotal = {};
    let idsumRenderedStatus = {};
    let idsumRenderedAction = {};

    // 4. Sinh các dòng của bảng
    pageData.forEach(item => {
        const tr = document.createElement('tr');
        
        const isPaid = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1;
        const statusText = isPaid
            ? "<b style='color:#10b981;'>Đã thanh toán</b>" 
            : "<b style='color:#ef4444;'>Chưa thanh toán</b>";
        
        // Cột 1: Mã số thuế
        //tr.innerHTML += "<td>" + (item.MaSoThue || '') + "</td>";
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedMST[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.MaSoThue || '') + "</td>";
                idsumRenderedMST[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.MaSoThue || '') + "</td>";
        }
        
        // Cột 2: Họ và Tên (Gộp ô)
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedName[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff; '>" + (item.Ho || '') + " " + (item.Ten || '') + "</td>";
                idsumRenderedName[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.Ho || '') + " " + (item.Ten || '') + "</td>";
        }

        // Cột 3: CCCD (Gộp ô tương tự Họ Tên)
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedCCCD[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.CCCD || '') + "</td>";
                idsumRenderedCCCD[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.CCCD || '') + "</td>";
        }

        // Cột 4, 5, 6: Địa bàn và số tiền lẻ dòng
        //tr.innerHTML += "<td>" + (item.ThonTo || '') + "</td>";
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedThonTo[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.ThonTo || '') + "</td>";
                idsumRenderedThonTo[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.ThonTo || '') + "</td>";
        }
        //tr.innerHTML += "<td>" + (item.PhuongXa || '') + "</td>";
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedPhuongXa[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.PhuongXa || '') + "</td>";
                idsumRenderedPhuongXa[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.PhuongXa || '') + "</td>";
        }
        tr.innerHTML += "<td>" + (item.MaPhiNN || '') + "</td>";
        tr.innerHTML += "<td>" + (item.TieuMuc || '') + "</td>";
        tr.innerHTML += "<td>" + (item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0) + " đ</td>";

        // Cột 7: Tổng tiền thanh toán nộp gộp (Gộp ô theo IDSUM)
        const totalGroupAmount = idsumTotals[item.IDSUM] || Number(item.SoTienThuThue) || 0;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedTotal[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #f8fafc; font-weight: bold; color: #1e3a8a; text-align: right;'>" + totalGroupAmount.toLocaleString('vi-VN') + " đ</td>";
                idsumRenderedTotal[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td style='font-weight: bold; color: #1e3a8a; text-align: right;'>" + totalGroupAmount.toLocaleString('vi-VN') + " đ</td>";
        }

        // Cột 8: Trạng thái dòng lẻ
        //tr.innerHTML += "<td>" + statusText + "</td>";
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedStatus[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + statusText + "</td>";
                idsumRenderedStatus[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + statusText + "</td>";
        }
        
        // Cột 9: Hành động gộp chung duy nhất một nút bấm mã QR cho các dòng cùng IDSUM
        const targetIdSum = item.IDSUM || item.ID;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedAction[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; text-align: center; background-color: #ffffff;'>\
                    <button class='btn-table-qr' onclick=\"openQrPopupByIdSum('" + targetIdSum + "')\">⚙ Quét QR</button>\
                </td>";
                idsumRenderedAction[item.IDSUM] = true;
            }
        } else if (!item.IDSUM || idsumCountsInPage[item.IDSUM] <= 1) {
            tr.innerHTML += "<td style='text-align: center;'>\
                <button class='btn-table-qr' onclick=\"openQrPopupByIdSum('" + targetIdSum + "')\">⚙ Quét QR</button>\
            </td>";
        }
        
        tbody.appendChild(tr);
    });

    updatePaginationControls(filteredData.length);
}

function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    document.getElementById('pageInfo').innerText = "Trang " + currentPage + " / " + totalPages;
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

// Mở QR Popup gộp thanh toán theo IDSUM
async function openQrPopupByIdSum(idsum) { 
    if (!idsum) return;

    const groupRecords = allData.filter(x => x.IDSUM === idsum || x.ID === idsum);
    if (groupRecords.length === 0) return;

    const baseItem = groupRecords[0];
    currentSelectedIdSum = idsum; 

    // Đồng bộ kiểm tra trạng thái gạt: Chỉ bật ON khi tất cả các dòng đều đã đóng
    const isAllPaid = groupRecords.every(item => item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1);

    isUpdatingToggle = true; 
    document.getElementById('switchPaymentStatus').checked = isAllPaid;
    document.getElementById('toggleStatusLabel').innerText = isAllPaid ? "ON (Đã Nộp)" : "OFF (Chưa Nộp)";
    document.getElementById('toggleStatusLabel').style.color = isAllPaid ? "#10b981" : "#ef4444";
    isUpdatingToggle = false;

    // Tính tổng số tiền thu thuế cộng dồn
    let totalAmount = 0;
    groupRecords.forEach(r => {
        totalAmount += (Number(r.SoTienThuThue) || 0);
    });

    const hoten = (baseItem.Ho || '') + " " + (baseItem.Ten || '');
    
    // CẤU TRÚC NỘI DUNG CHUYỂN KHOẢN MỚI TỰ ĐỘNG ĐO ĐỘ DÀI
    const rawPurpose = (baseItem.MaSoThue || '') + " " + hoten + " nop thue dat ID" + (baseItem.IDSUM || baseItem.ID || '');
    const purpose = removeVietnameseTones(rawPurpose).replace(/\s+/g, ' '); // Xóa dấu và khoảng trắng thừa

    // Đặt ảnh tạm trong lúc đợi API POST phản hồi
    document.getElementById('qrImage').src = "https://placehold.co/300x300?text=Dang+tao+ma+QR...";
    document.getElementById('qrPopup').classList.remove('hidden');

    // HIỂN THỊ THÔNG TIN CHỮ LÊN GIAO DIỆN CHÍNH XÁC
    document.getElementById('qrInfo').innerHTML = `
        <b>Người nộp thuế:</b> ${hoten}<br>
        <b>Mã Số Thuế:</b> ${baseItem.MaSoThue || ''}<br>
        <b>CCCD:</b> ${baseItem.CCCD || ''}<br>
        <b>Số khoản thuế phải nộp:</b> <span style="font-weight:bold; color:#4338ca;">${groupRecords.length} </span><br>
        <b>Tổng số tiền phải nộp:</b> <span style="color:#1e3a8a; font-weight:bold;">${totalAmount.toLocaleString('vi-VN')} đ</span><br>
        <b>Nội dung chuyển khoản:</b> <span style="color:#c2410c; font-weight:bold;">${purpose}</span>
    `;

    // THỰC HIỆN GỌI API POST ĐỂ ĐẢM BẢO CHUỖI KHÔNG BỊ CẮT CHỮ
    try {
        const response = await fetch("https://api.vietqr.io/v2/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accountNo: BANK_ACCOUNT,
                accountName: hoten, 
                acqId: BANK_BIN, // Sử dụng mã 970405 đã cấu hình ở đầu file
                amount: totalAmount,
                addInfo: purpose, 
                format: "qr_only",
                template: "compact"
            })
        });

        const result = await response.json();
        if (result && result.code === "00") {
            // Đổ trực tiếp dữ liệu ảnh QR chuẩn mã hóa Base64 vào thẻ img
            document.getElementById('qrImage').src = result.data.qrDataURL;
        } else {
            console.warn("API POST trả về lỗi, chuyển sang giải pháp tính chuỗi Tag 62 thủ công");
            generateFallbackQrUrl(totalAmount, purpose);
        }
    } catch (error) {
        console.error("Lỗi kết nối API VietQR POST, chuyển sang giải pháp thủ công:", error);
        generateFallbackQrUrl(totalAmount, purpose);
    }
}

// Hàm dự phòng: Tạo ảnh QR thủ công tính độ dài động chính xác từng ký tự trong trường hợp API POST lỗi
function generateFallbackQrUrl(amount, info) {
    // Đoạn mã tạo chuẩn chuỗi Tag 62 động
    const subTagData = "08" + info.length.toString().padStart(2, '0') + info;
    const tag62String = "62" + subTagData.length.toString().padStart(2, '0') + subTagData;
    
    // Tạo link ảnh VietQR dựa trên tham số addInfo đã mã hóa URL đầy đủ
    const fallbackUrl = "https://img.vietqr.io/image/970405-" + BANK_ACCOUNT + "-qr_only.png?amount=" + amount + "&addInfo=" + encodeURIComponent(info);
    document.getElementById('qrImage').src = fallbackUrl;
}

// Đồng bộ cập nhật trạng thái đóng thuế hàng loạt lên Firebase
function verifyAndPayChange(toggleElement) {
    if (isUpdatingToggle || !currentSelectedIdSum) return;

    const isChecked = toggleElement.checked; 
    const statusMsg = isChecked ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN";
    
    if (confirm("Bạn muốn cập nhật trạng thái ĐỒNG LOẠT cho toàn bộ dòng có cùng IDSUM sang: " + statusMsg + "?")) {
        
        const groupRecords = allData.filter(x => x.IDSUM === currentSelectedIdSum || x.ID === currentSelectedIdSum);
        let updatePromises = [];

        groupRecords.forEach(item => {
            const recordKey = item.ID; 
            
            if (recordKey) {
                let p = db.ref('QRCodeTax/' + recordKey).update({
                    DaThanhToan: isChecked ? true : false,
                    DaThanhToanStr: isChecked ? "true" : "false" 
                });
                updatePromises.push(p);
            }
        });

        if (updatePromises.length === 0) {
            alert("Không tìm thấy mã dòng (ID) hợp lệ để cập nhật!");
            isUpdatingToggle = true;
            toggleElement.checked = !isChecked;
            isUpdatingToggle = false;
            return;
        }

        Promise.all(updatePromises).then(() => {
            document.getElementById('toggleStatusLabel').innerText = isChecked ? "ON (Đã Đóng)" : "OFF (Chưa Đóng)";
            document.getElementById('toggleStatusLabel').style.color = isChecked ? "#10b981" : "#ef4444";
            alert("Đã cập nhật trạng thái thành công lên cơ sở dữ liệu!");
            
            closePopup();
            searchData(true);
        }).catch((error) => {
            alert("Lỗi kết nối Firebase: " + error.message);
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
