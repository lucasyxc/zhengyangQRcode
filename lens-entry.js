document.addEventListener('DOMContentLoaded', () => {
    const lensEntryForm = document.getElementById('lens-entry-form');
    const addLensButton = document.getElementById('add-lens');
    const batchUploadButton = document.getElementById('batch-upload');
    const modal = document.getElementById('modal');
    const batchSubmitButton = document.getElementById('batch-submit');
    const batchProductNameSelect = document.getElementById('batch-product-name');
    const resultsDiv = document.getElementById('results');
    const viewQrcodesButton = document.getElementById('view-qrcodes');
    const printAllQrcodesButton = document.getElementById('print-all-qrcodes');
    const excelButton = document.getElementById('excel');
    const grid = document.getElementById('batch-grid');
    let lensCounter = 1;
    let isDragging = false;
    let startCell = null;
    let lastCell = null; // 用于跟踪最后一个经过的单元格
    let isRightClick = false;

    // 从localStorage获取organization_id
    const organizationId = localStorage.getItem('organization_id');
    
    // 根据organization_id过滤可选的镜片组
    const getFilteredGroups = () => {
        // 只返回 group2 的镜片
        return { group2: groups.group2 };
    };

    // 从JSON文件加载数据
    let groups = {};
    let technicalParams = {};

    fetch('lens_mapping.json')
        .then(response => response.json())
        .then(data => {
            groups = data.groups;
            technicalParams = data.technicalParams;
            
            // 获取过滤后的组
            const filteredGroups = getFilteredGroups();
            
            // 动态生成产品名选项
            const productNameSelect = document.getElementById('product-name-0');
            for (const groupKey in filteredGroups) {
                const group = filteredGroups[groupKey];
                for (const productName in group.products) {
                    const option = document.createElement('option');
                    option.value = productName;
                    option.textContent = productName;
                    option.dataset.group = groupKey;
                    productNameSelect.appendChild(option);
                }
            }

            // 批量录入的产品选择
            for (const groupKey in filteredGroups) {
                const group = filteredGroups[groupKey];
                for (const productName in group.products) {
                    const option = document.createElement('option');
                    option.value = productName;
                    option.textContent = productName;
                    option.dataset.group = groupKey;
                    batchProductNameSelect.appendChild(option);
                }
            }
        })
        .catch(error => {
            console.error('加载镜片数据失败:', error);
            alert('加载镜片数据失败，请刷新页面重试');
        });

    const productNameCode = {
        '爱眼星点矩阵1.60MR-8近视管理镜片': 'A',
        '爱眼星点矩阵1.67近视管理镜片': 'B',
        '爱眼星1.56多微透镜离焦专业版': 'C',
        '爱眼星1.60双面复合多微透镜离焦镜片': 'D',
    };

    const generateUniqueSerialNumber = (baseSerialNumber, index) => {
        return `${baseSerialNumber}-${index + 1}`;
    };

    const generateLensData = (productName, spherical, cylinder, quantity) => {
        // 检查是否为group2的产品
        for (const groupKey in groups) {
            const group = groups[groupKey];
            if (group.products[productName]) {
                if (groupKey === 'group2') {
                    // 使用group2的函数生成数据
                    return window.group2Functions.generateLensData(productName, spherical, cylinder, quantity);
                }
                break;
            }
        }

        // 原有的group1数据生成逻辑
        const lenses = [];
        const baseSerialNumber = new Date().toISOString().replace(/[-:.TZ]/g, '');

        // 生成连续的序列号
        for (let i = 0; i < quantity; i++) {
            const serialNumber = `${baseSerialNumber}-${i + 1}`;
            const productData = groups.group1.products[productName];
            
            const lens = {
                serial_number: serialNumber,
                product_name: productName,
                spherical: parseFloat(spherical).toFixed(2),
                cylinder: parseFloat(cylinder).toFixed(2),
                refraction: productData.refraction,
                abbe_number: productData.abbeNumber,
                dia: '75mm', // 默认值，稍后根据参数更新
                ct: '2.0±0.3mm', // 默认值，稍后根据参数更新
                production_date: new Date().toISOString().split('T')[0],
                grade: 'A级',
                qrStyle: 'style1'
            };

            lenses.push(lens);
        }

        return lenses;
    };

    const formatLensValue = (value) => {
        return parseFloat(value).toFixed(2);
    };

    const updateLensParams = (lens) => {
        const spherical = parseFloat(lens.spherical);
        const cylinder = parseFloat(lens.cylinder);
        const paramsDia = technicalParams[lens.product_name].dia.find(param => {
            return spherical >= param.powerRange.min && spherical <= param.powerRange.max &&
                   (!param.cylinderRange || (cylinder >= param.cylinderRange.min && cylinder <= param.cylinderRange.max));
        });

        const paramsThickness = technicalParams[lens.product_name].thickness.find(param => {
            return spherical >= param.powerRange.min && spherical <= param.powerRange.max &&
                   (!param.cylinderRange || (cylinder >= param.cylinderRange.min && cylinder <= param.cylinderRange.max));
        });

        if (paramsDia) {
            lens.dia = paramsDia.dia;
        }

        if (paramsThickness) {
            if (paramsThickness.ct) {
                lens.ct = paramsThickness.ct;
                lens.et = undefined; // 确保 et 不会干扰 ct
            }
            if (paramsThickness.et) {
                lens.et = paramsThickness.et;
                lens.ct = undefined; // 确保 ct 不会干扰 et
            }
        } else {
            console.error(`No technical parameters found for spherical: ${spherical}, cylinder: ${cylinder} in product: ${lens.product_name}`);
        }

        console.log('Updated lens params:', lens); // 调试信息
        return lens;
    };

    const generatePrintContent = (lens, callback) => {
        if (lens.qrStyle === 'style2') {
            // 使用group2的二维码生成函数，直接传入完整的镜片数据
            window.group2Functions.generateQRCode(lens, callback);
            return;
        }

        // 原有的style1二维码生成逻辑
        const { serial_number, product_name, spherical, cylinder, refraction, abbe_number, dia, ct, et, production_date, grade } = lens;
        const productCode = productNameCode[product_name] || '';
        const sphericalFormatted = (spherical > 0 ? `+${formatLensValue(spherical)}` : formatLensValue(spherical));
        const cylinderFormatted = (cylinder > 0 ? `+${formatLensValue(cylinder)}` : formatLensValue(cylinder));
        const positiveSpherical = (parseFloat(spherical) + parseFloat(cylinder) > 0 ? `+${formatLensValue(parseFloat(spherical) + parseFloat(cylinder))}` : formatLensValue(parseFloat(spherical) + parseFloat(cylinder)));
        const positiveCylinder = (parseFloat(-cylinder) > 0 ? `+${formatLensValue(-cylinder)}` : formatLensValue(-cylinder));

        // 生产日期格式转换
        const formattedProductionDate = production_date.replace(/-/g, '');

        const qrContent = `http://plmsys.aiforoptometry.com/detail?serial_number=${encodeURIComponent(serial_number)}`;

        const scale = 3; // 增加缩放比例以提高清晰度
        const canvasWidth = 710; // 对应71mm（考虑2mm边距）
        const canvasHeight = 460; // 对应46mm（考虑2mm边距）
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        const headerHeight = canvasHeight / 3;
        const contentHeight = (canvasHeight / 3) * 2;
        const qrSize = contentHeight * 0.6;
        const qrX = canvasWidth - qrSize - 20;
        const qrY = canvasHeight - qrSize - 20;

        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = qrSize;
        qrCanvas.height = qrSize;

        QRCode.toCanvas(qrCanvas, qrContent, { width: qrSize, height: qrSize, errorCorrectionLevel: 'H' }, (err) => {
            if (err) {
                console.error('QR Code generation error:', err);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

            const fontSize = canvasWidth * 0.04; // 增加字体大小为7%的宽度
            const productNameFontSize = fontSize * 1.20; // 品名字体稍大一些
            const lineHeight = fontSize * 1.5; // 行高

            // 绘制虚线
            ctx.setLineDash([10, 5]);
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, headerHeight);
            ctx.lineTo(canvasWidth, headerHeight);
            ctx.stroke();
            ctx.setLineDash([]); // 清除虚线设置

            // 绘制文本框，上部贴近画布边缘
            const textBoxMargin = 10 * scale; // 文本框边距
            const textBoxX = textBoxMargin;
            const textBoxY = textBoxMargin - 20;
            const textBoxWidth = canvasWidth - textBoxMargin * 2;
            const textBoxHeight = headerHeight - textBoxMargin * 2;
            ctx.strokeRect(textBoxX, textBoxY, textBoxWidth, textBoxHeight);

            // 旋转文本框中的文字180°
            ctx.save();
            ctx.translate(textBoxX + textBoxWidth / 2, textBoxY + textBoxHeight / 2);
            ctx.rotate(Math.PI);
            ctx.translate(-textBoxX - textBoxWidth / 2, -textBoxY - textBoxHeight / 2);

            ctx.font = `900 ${fontSize}px SimHei`; // 使用黑体并加粗
            ctx.textAlign = 'left';

            // 文本框内的文本
            const textXOffset = textBoxX + 10; // 调整X轴偏移量
            let textYOffset = textBoxY - 15 + lineHeight; // 调整Y轴偏移量

            // 品名和虚线之间一个行距
            ctx.fillText(`品名: ${product_name}`, textXOffset, textYOffset);

            // 球镜S和柱镜C
            textYOffset += lineHeight;
            ctx.font = `900 ${fontSize * 1.3}px SimHei`; // 放大字体 1.2 倍
            ctx.fillText(`球镜S: ${sphericalFormatted}   柱镜C: ${cylinderFormatted}`, textXOffset, textYOffset);

            // 正柱镜格式的度数，前缩进2个汉字的距离
            textYOffset += lineHeight;
            ctx.fillText(`    S: ${positiveSpherical}       C: ${positiveCylinder}`, textXOffset, textYOffset);

            // 恢复字体大小以继续绘制其他文本
            ctx.font = `900 ${fontSize}px SimHei`;
            ctx.restore();

            ctx.font = `900 ${productNameFontSize}px SimHei`;
            ctx.fillText(`品名: ${product_name}`, canvasWidth * 0.05, headerHeight + lineHeight * 2);

            // 下部分内容整体上移半行距离
            const tableX = canvasWidth * 0.05;
            const tableY = headerHeight + lineHeight * 3.7;
            const cellWidth = 170 * scale;
            const cellHeight = lineHeight * 1.5;
            const tableData = [
                [`折射率:${refraction}`, `阿贝数:${abbe_number}`],
                [et ? `ET: ${et}` : `CT:${ct}`, `Dia:${dia}`],
                [`生产日期:${formattedProductionDate}`, `等级:${grade}`]
            ];

            tableData.forEach((row, rowIndex) => {
                row.forEach((cell, cellIndex) => {
                    ctx.fillText(cell, tableX + cellIndex * cellWidth, tableY + rowIndex * cellHeight);
                });
            });

            const img = new Image();
            img.src = canvas.toDataURL();
            img.width = 710; // 设置显示宽度为71mm对应的像素
            img.height = 460; // 设置显示高度为46mm对应的像素
            img.style.margin = '5px';

            console.log('Image generated for modal:', img);

            callback(img);
        });
    };

    // 提交镜片数据
    async function submitLensData(lensData) {
        try {
            // 输出完整的原始数据
            console.log('准备提交的原始数据:', JSON.stringify(lensData, null, 2));
            
            // 确保数据格式正确，并设置默认值
            const formattedData = lensData.map(lens => ({
                serial_number: lens.serial_number || '',
                product_name: lens.product_name || '',
                spherical: parseFloat(lens.spherical || 0).toFixed(2),
                cylinder: parseFloat(lens.cylinder || 0).toFixed(2),
                refraction: parseFloat(lens.refraction || 1.5).toFixed(2),
                abbe_number: parseFloat(lens.abbe_number || 30).toFixed(2)
            }));

            // 输出格式化后的数据
            console.log('格式化后的数据:', JSON.stringify(formattedData, null, 2));
            console.log('模拟提交到后端接口: http://plmsys.aiforoptometry.com/add_lenses/');

            // 注释掉实际的后端提交代码
            /*
            const response = await fetch('http://plmsys.aiforoptometry.com/add_lenses/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formattedData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }
            */

            // 模拟成功响应
            const mockResult = {
                success: true,
                message: '提交成功（测试模式）',
                data: formattedData
            };
            console.log('模拟提交成功，返回数据:', JSON.stringify(mockResult, null, 2));
            return mockResult;
        } catch (error) {
            console.error('提交失败:', error);
            throw error;
        }
    }

    // 批量提交镜片数据
    async function submitBatchLensData(lenses) {
        try {
            // 输出完整的原始数据
            console.log('准备批量提交的原始数据:', JSON.stringify(lenses, null, 2));
            
            // 确保数据格式正确，并设置默认值
            const formattedData = lenses.map(lens => ({
                serial_number: lens.serial_number || '',
                product_name: lens.product_name || '',
                spherical: parseFloat(lens.spherical || 0).toFixed(2),
                cylinder: parseFloat(lens.cylinder || 0).toFixed(2),
                refraction: parseFloat(lens.refraction || 1.5).toFixed(2),
                abbe_number: parseFloat(lens.abbe_number || 30).toFixed(2)
            }));

            // 输出格式化后的数据
            console.log('格式化后的数据:', JSON.stringify(formattedData, null, 2));
            console.log('模拟提交到后端接口: http://plmsys.aiforoptometry.com/add_lenses/');

            // 注释掉实际的后端提交代码
            /*
            const response = await fetch('http://plmsys.aiforoptometry.com/add_lenses/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formattedData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }
            */

            // 模拟成功响应
            const mockResult = {
                success: true,
                message: '批量提交成功（测试模式）',
                data: formattedData
            };
            console.log('模拟批量提交成功，返回数据:', JSON.stringify(mockResult, null, 2));
            return mockResult;
        } catch (error) {
            console.error('批量提交失败:', error);
            throw error;
        }
    }

    // 现有表单提交功能
    if (lensEntryForm) {
        lensEntryForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const entries = lensEntryForm.querySelectorAll('.lens-entry');
            let lenses = [];

            entries.forEach((entry, index) => {
                const productName = entry.querySelector(`[name="product-name"]`).value;
                const spherical = entry.querySelector(`[name="spherical"]`).value;
                const cylinder = entry.querySelector(`[name="cylinder"]`).value;
                const quantity = parseInt(entry.querySelector(`[name="quantity"]`).value, 10);

                const lensBatch = generateLensData(productName, spherical, cylinder, quantity);
                lenses = lenses.concat(lensBatch);
            });

            try {
                // 开发环境：仅输出到控制台
                console.log('准备提交的镜片数据:', lenses);
                console.log('提交到 /api/lenses 接口');
                
                // 生产环境：发送数据到后端
                const result = await submitLensData(lenses);
                
                // 清空表单
                entries.forEach((entry) => {
                    lensEntryForm.removeChild(entry);
                });
                lensEntryForm.reset();
                lensCounter = 1;

                // 显示成功消息
                alert(`成功录入 ${lenses.length} 片镜片`);
                
                // 生成并显示二维码
                lenses.forEach(lens => {
                    generatePrintContent(lens, (img) => {
                        resultsDiv.appendChild(img);
                    });
                });

                // 显示查看二维码按钮
                viewQrcodesButton.style.display = 'inline-block';

            } catch (error) {
                console.error('提交失败:', error);
                alert('提交失败，请检查网络连接或联系管理员');
            }
        });
    }

    // 新增条目功能
    if (addLensButton) {
        addLensButton.addEventListener('click', () => {
            const newLensEntry = document.createElement('div');
            newLensEntry.classList.add('lens-entry');
            
            // 获取过滤后的组
            const filteredGroups = getFilteredGroups();
            
            newLensEntry.innerHTML = `
                <label for="product-name-${lensCounter}">品名:</label>
                <select id="product-name-${lensCounter}" name="product-name" required>
                    ${Object.keys(filteredGroups).map(groupKey => {
                        const group = filteredGroups[groupKey];
                        return `<optgroup label="${group.name}">${Object.keys(group.products).map(productName => `<option value="${productName}">${productName}</option>`).join('')}</optgroup>`;
                    }).join('')}
                </select>
                <label for="spherical-${lensCounter}">球镜度数:</label>
                <input type="text" id="spherical-${lensCounter}" name="spherical" required>
                <label for="cylinder-${lensCounter}">柱镜度数:</label>
                <input type="text" id="cylinder-${lensCounter}" name="cylinder" required>
                <label for="quantity-${lensCounter}">数量:</label>
                <input type="number" id="quantity-${lensCounter}" name="quantity" value="1" min="1" required>
                <button type="button" class="remove-lens">删除</button>
            `;
            lensEntryForm.insertBefore(newLensEntry, addLensButton);
            lensCounter++;
        });
    }

    // 删除条目功能
    lensEntryForm.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('remove-lens')) {
            const entryToRemove = e.target.closest('.lens-entry');
            if (entryToRemove) {
                lensEntryForm.removeChild(entryToRemove);
            }
        }
    });

    // 批量录入模态窗口
    if (batchUploadButton) {
        batchUploadButton.addEventListener('click', () => {
            const batchModal = new bootstrap.Modal(modal);
            batchModal.show();
        });
    }

    // 批量录入提交功能
    if (batchSubmitButton) {
        batchSubmitButton.addEventListener('click', async () => {
            const selectedProductName = batchProductNameSelect.value;
            const cells = document.querySelectorAll('.batch-cell');
            let lenses = [];
            let totalQuantity = 0;

            // 首先计算总数量
            cells.forEach(cell => {
                const quantity = parseInt(cell.value || '0', 10);
                totalQuantity += quantity;
            });

            // 生成基础序列号
            const baseSerialNumber = new Date().toISOString().replace(/[-:.TZ]/g, '');
            let currentIndex = 1;

            // 查找产品所属组别
            let productGroup = null;
            for (const groupKey in groups) {
                if (groups[groupKey].products[selectedProductName]) {
                    productGroup = groupKey;
                    break;
                }
            }

            if (!productGroup) {
                alert('未找到产品信息，请刷新页面重试');
                return;
            }

            cells.forEach(cell => {
                const quantity = parseInt(cell.value || '0', 10);
                if (quantity > 0) {
                    const { spherical, cylinder } = cell.dataset;
                    
                    if (productGroup === 'group2') {
                        // 使用group2的函数生成数据
                        const lensBatch = window.group2Functions.generateLensData(
                            selectedProductName, 
                            spherical, 
                            cylinder, 
                            quantity
                        );
                        // 更新序列号
                        lensBatch.forEach((lens, index) => {
                            lens.serial_number = `${baseSerialNumber}-${currentIndex + index}`;
                        });
                        lenses = lenses.concat(lensBatch);
                        currentIndex += quantity;
                    } else {
                        // 原有的group1数据生成逻辑
                        for (let i = 0; i < quantity; i++) {
                            const serialNumber = `${baseSerialNumber}-${currentIndex}`;
                            const productData = groups.group1.products[selectedProductName];
                            
                            const lens = {
                                serial_number: serialNumber,
                                product_name: selectedProductName,
                                spherical: parseFloat(spherical).toFixed(2),
                                cylinder: parseFloat(cylinder).toFixed(2),
                                refraction: productData.refraction,
                                abbe_number: productData.abbeNumber,
                                dia: '75mm',
                                ct: '2.0±0.3mm',
                                production_date: new Date().toISOString().split('T')[0],
                                grade: 'A级',
                                qrStyle: 'style1'
                            };
                            lenses.push(lens);
                            currentIndex++;
                        }
                    }
                }
            });

            try {
                // 输出完整的原始数据
                console.log('准备批量提交的原始数据:', JSON.stringify(lenses, null, 2));
                
                // 生产环境：发送数据到后端
                const result = await submitBatchLensData(lenses);
                
                // 关闭模态窗口
                const batchModal = bootstrap.Modal.getInstance(modal);
                batchModal.hide();

                // 清空所有单元格内容
                cells.forEach(cell => {
                    cell.value = '';
                    cell.classList.remove('selected');
                });
                batchProductNameSelect.value = '';

                // 显示成功消息
                alert(`成功批量录入 ${lenses.length} 片镜片`);
                
                // 生成并显示二维码
                lenses.forEach(lens => {
                    generatePrintContent(lens, (img) => {
                        resultsDiv.appendChild(img);
                    });
                });

                // 显示查看二维码按钮
                viewQrcodesButton.style.display = 'inline-block';

            } catch (error) {
                console.error('批量提交失败:', error);
                alert('批量提交失败，请检查网络连接或联系管理员');
            }
        });
    }

    if (excelButton) {
        excelButton.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function (event) {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    // 去掉首行和首列
                    const filteredData = jsonData.slice(1).map(row => row.slice(1));

                    // 打印数据到控制台
                    console.log(filteredData);

                    // 动态填充到棋盘格
                    filteredData.forEach((row, rowIndex) => {
                        row.forEach((value, colIndex) => {
                            const cell = document.querySelector(
                                `.batch-cell[data-spherical="${(-rowIndex * 0.25).toFixed(2)}"]` +
                                `[data-cylinder="${(-colIndex * 0.25).toFixed(2)}"]`
                            );
                            if (cell) {
                                cell.value = value !== null ? value : ''; // 将值填入单元格
                            }
                        });
                    });
                };
                reader.readAsArrayBuffer(file);
            });
            input.click();
        });
    }

    // 创建批量录入的棋盘格
    const createBatchGrid = () => {
        const rows = 45; // 总行数
        const cols = 21; // 标签列之外的总列数

        // 清空现有内容
        grid.innerHTML = '';

        // 创建第一行（列标签，Cylinder方向）
        for (let col = 0; col <= cols; col++) {
            const colLabel = document.createElement('div');
            colLabel.classList.add('axis-label');
            if (col > 0) {
                colLabel.textContent = (0 - (col - 1) * 0.25).toFixed(2);
            }
            grid.appendChild(colLabel);
        }

        // 创建其余行（每行的第一个单元格为行标签，Spherical方向）
        for (let row = 0; row < rows; row++) {
            // 创建每行的首个标签（行标签）
            const rowLabel = document.createElement('div');
            rowLabel.classList.add('axis-label');
            rowLabel.textContent = (0 - row * 0.25).toFixed(2);
            grid.appendChild(rowLabel);

            // 创建每行的其余单元格
            for (let col = 0; col < cols; col++) {
                const cell = document.createElement('input');
                cell.type = 'text';
                cell.classList.add('batch-cell');
                cell.dataset.spherical = (0 - row * 0.25).toFixed(2);
                cell.dataset.cylinder = (0 - col * 0.25).toFixed(2);
                grid.appendChild(cell);
            }
        }
    };
    createBatchGrid();

    // 监听鼠标按下事件，开始框选
    grid.addEventListener('mousedown', (e) => {
        const cell = e.target;
        if (cell.classList.contains('batch-cell')) {
            isDragging = true;
            startCell = cell;
            lastCell = cell;
            isRightClick = e.button === 2; // 判断是否为右键点击
            if (!isRightClick) {
                cell.value = '1'; // 左键单击时，设置值为 1
            }
            e.preventDefault(); // 禁止默认右键菜单
        }
    });

    // 监听鼠标移动事件，记录当前选中的区域
    grid.addEventListener('mousemove', (e) => {
        if (isDragging && startCell) {
            const cell = e.target;
            if (cell.classList.contains('batch-cell')) {
                lastCell = cell;
                if (isRightClick) {
                    cell.value = ''; // 右键拖拽时，清空值
                } else {
                    cell.value = '1'; // 左键拖拽时，设置值为 1
                }
                cell.classList.add('selected'); // 可选：在拖拽时添加视觉提示，显示选中的区域
            }
        }
    });

    // 监听鼠标松开事件，结束框选，并设置最后一个经过的单元格为当前选中单元格
    grid.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (lastCell) {
                lastCell.focus();
            }
            startCell = null;
            lastCell = null;
        }
    });

    // 阻止右键菜单的默认行为（可选）
    document.addEventListener('contextmenu', (e) => {
        if (isDragging) {
            e.preventDefault(); // 禁止在拖拽过程中右键菜单弹出
        }
    });

    // 方向键快捷移动光标功能
    grid.addEventListener('keydown', (e) => {
        const cell = e.target;
        if (!cell.classList.contains('batch-cell')) return;

        let rowIndex = parseFloat(cell.dataset.spherical);
        let colIndex = parseFloat(cell.dataset.cylinder);
        let targetCell;

        switch (e.key) {
            case 'ArrowUp':
                targetCell = document.querySelector(`.batch-cell[data-spherical="${(rowIndex + 0.25).toFixed(2)}"][data-cylinder="${colIndex.toFixed(2)}"]`);
                break;
            case 'ArrowDown':
                targetCell = document.querySelector(`.batch-cell[data-spherical="${(rowIndex - 0.25).toFixed(2)}"][data-cylinder="${colIndex.toFixed(2)}"]`);
                break;
            case 'ArrowLeft':
                targetCell = document.querySelector(`.batch-cell[data-spherical="${rowIndex.toFixed(2)}"][data-cylinder="${(colIndex + 0.25).toFixed(2)}"]`);
                break;
            case 'ArrowRight':
                targetCell = document.querySelector(`.batch-cell[data-spherical="${rowIndex.toFixed(2)}"][data-cylinder="${(colIndex - 0.25).toFixed(2)}"]`);
                break;
            default:
                return; // 如果不是方向键，直接返回
        }

        if (targetCell) {
            targetCell.focus();
            targetCell.select();
            e.preventDefault();
        }
    });

    // 查看二维码图片的模态窗口功能
    viewQrcodesButton.addEventListener('click', () => {
        const modalBody = document.getElementById('qrcode-images');
        modalBody.innerHTML = ''; // 清空之前的内容

        const qrcodeImages = resultsDiv.querySelectorAll('img');
        console.log('Images found in resultsDiv:', qrcodeImages);

        qrcodeImages.forEach(img => {
            const clonedImg = img.cloneNode(true);
            modalBody.appendChild(clonedImg);
            console.log('Image added to modal:', clonedImg);
        });

        if (qrcodeImages.length === 0) {
            modalBody.innerHTML = '<p>没有生成的二维码图片。</p>';
        }

        const viewModal = new bootstrap.Modal(document.getElementById('view-modal'));
        viewModal.show();
    });

    // 打印所有二维码的功能
    printAllQrcodesButton.addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        const modalBody = document.getElementById('qrcode-images');
        
        // 计算每行显示的图片数量
        const images = modalBody.querySelectorAll('img');
        const imagesPerRow = Math.min(3, images.length); // 每行最多显示3张图片
        
        // 创建打印样式
        const printStyle = `
            <style>
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .print-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 2mm;
                    }
                    .print-item {
                        width: 71mm;  /* 75mm纸张宽度减去边距 */
                        height: 46mm; /* 50mm纸张高度减去边距 */
                        text-align: center;
                        page-break-after: always;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                    }
                    @page {
                        size: 75mm 50mm;
                        margin: 2mm;
                    }
                }
            </style>
        `;
        
        // 创建打印内容
        let printContent = '<div class="print-container">';
        images.forEach(img => {
            printContent += `
                <div class="print-item">
                    ${img.outerHTML}
                </div>
            `;
        });
        printContent += '</div>';
        
        // 写入打印窗口
        printWindow.document.write(`
            <html>
                <head>
                    <title>打印二维码</title>
                    ${printStyle}
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        
        // 添加打印完成后的处理
        printWindow.onafterprint = () => {
            const viewModal = bootstrap.Modal.getInstance(document.getElementById('view-modal'));
            viewModal.hide();
            modalBody.innerHTML = '';
        };
        
        // 添加打印前的预览
        setTimeout(() => {
            printWindow.print();
        }, 1000);
    });

    // 模态窗口关闭功能并清空单元格内容
    document.querySelectorAll('.btn-close, .btn-secondary').forEach(button => {
        button.addEventListener('click', (e) => {
            const modal = bootstrap.Modal.getInstance(e.target.closest('.modal'));
            modal.hide();

            // 清空所有单元格内容（不清空标签行和标签列）
            document.querySelectorAll('.batch-cell').forEach(cell => {
                cell.value = '';
                cell.classList.remove('selected');
            });
        });
    });
});
