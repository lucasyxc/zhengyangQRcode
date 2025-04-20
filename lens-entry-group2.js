// Group2 镜片处理和样式2二维码生成
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    const lensEntryForm = document.getElementById('lens-entry-form');
    const batchProductNameSelect = document.getElementById('batch-product-name');
    const resultsDiv = document.getElementById('results');

    // 从JSON文件加载Group2数据
    let group2Data = null;
    let dataLoaded = false;

    // 根据球镜和柱镜获取直径
    const getDiameter = (diameterArray, spherical, cylinder) => {
        const sph = parseFloat(spherical);
        const cyl = parseFloat(cylinder);

        for (const param of diameterArray) {
            const powerRange = param.powerRange;
            const cylinderRange = param.cylinderRange;

            if (powerRange && cylinderRange) {
                if (sph >= powerRange.min && sph <= powerRange.max &&
                    cyl >= cylinderRange.min && cyl <= cylinderRange.max) {
                    return param.dia;
                }
            } else if (powerRange) {
                if (sph >= powerRange.min && sph <= powerRange.max) {
                    return param.dia;
                }
            }
        }
        return "未找到匹配的直径";
    };

    // 根据球镜和柱镜获取厚度
    const getThickness = (thicknessArray, spherical, cylinder) => {
        const sph = parseFloat(spherical);
        const cyl = parseFloat(cylinder);

        for (const param of thicknessArray) {
            const powerRange = param.powerRange;
            const cylinderRange = param.cylinderRange;

            if (powerRange && cylinderRange) {
                if (sph >= powerRange.min && sph <= powerRange.max &&
                    cyl >= cylinderRange.min && cyl <= cylinderRange.max) {
                    return param.ct || param.et;
                }
            } else if (powerRange) {
                if (sph >= powerRange.min && sph <= powerRange.max) {
                    return param.ct || param.et;
                }
            }
        }
        return "未找到匹配的厚度";
    };

    // 生成Group2镜片数据
    const generateGroup2LensData = (productName, spherical, cylinder, quantity) => {
        if (!dataLoaded) {
            console.error('数据尚未加载完成');
            return [];
        }

        const lenses = [];
        const baseSerialNumber = new Date().toISOString().replace(/[-:.TZ]/g, '');
        const productData = group2Data.products[productName];

        if (!productData) {
            console.error('未找到产品数据:', productName);
            return [];
        }

        for (let i = 0; i < quantity; i++) {
            const serialNumber = `${baseSerialNumber}-${i + 1}`;
            
            const lens = {
                serial_number: serialNumber,
                product_name: productName,
                spherical: parseFloat(spherical).toFixed(2),
                cylinder: parseFloat(cylinder).toFixed(2),
                group: group2Data.name,
                qrStyle: 'style2',
                brand: productData.brand,
                series: productData.series,
                diameter: getDiameter(productData.diameter, spherical, cylinder),
                centerThickness: getThickness(productData.centerThickness, spherical, cylinder),
                refraction: productData.refraction,
                abbeNumber: productData.abbeNumber,
                transmittance: productData.transmittance,
                coating: productData.coating,
                standard: productData.standard,
                production_date: new Date().toISOString().split('T')[0]
            };
            lenses.push(lens);
        }

        return lenses;
    };

    // 加载数据并设置状态
    const loadData = async () => {
        try {
            const response = await fetch('lens_mapping.json');
            const data = await response.json();
            group2Data = data.groups.group2;
            dataLoaded = true;
            console.log('数据加载完成');
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    };

    // 初始化时加载数据
    loadData();

    // 生成样式2二维码
    const generateStyle2QRCode = (lens, callback) => {
        // 产品名称映射表
        const productNameMap = {
            "优点星1.60点矩阵管理镜片": "1",
            "优点星1.60 MR-8PMDT点矩阵管理镜片": "2",
            "优点星1.67 PMDT点矩阵管理镜片": "3",
            "优点星1.56多效点矩阵管理镜片": "4",
            "优点星1.60多效点矩阵管理镜片": "5",
            "优赞1.60点矩阵管理镜片": "6",
            "优赞1.60 MR-8PMDT点矩阵管理镜片": "7",
            "优赞1.67 PMDT点矩阵管理镜片": "8",
            "优赞1.56多效点矩阵管理镜片": "9",
            "优赞1.60多效点矩阵管理镜片": "10"
        };

        // 构建简化的数据字符串
        const simpleData = [
            productNameMap[lens.product_name] || lens.product_name,  // 使用编码后的产品名称
            lens.spherical,             // 球镜
            lens.cylinder,              // 柱镜
            lens.serial_number          // 序列号
        ].join('|');

        // 构建简化的URL
        const qrContent = `https://lucasyxc.github.io/jingzhiguanwang/?d=${encodeURIComponent(simpleData)}`;

        const scale = 2;
        const canvasWidth = 375 * scale;
        const canvasHeight = 250 * scale;
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        const headerHeight = canvasHeight / 3;
        const contentHeight = (canvasHeight / 3) * 2;
        const qrSize = contentHeight * 0.6 * 0.9;  // 缩小至90%
        const qrX = canvasWidth - qrSize - 15 * scale;  // 向左移动15px
        const qrY = canvasHeight - qrSize - 15 * scale - (contentHeight * 0.045 * 1.5) - 20 * scale;  // 向上移动15px

        // 创建条形码
        const barcodeCanvas = document.createElement('canvas');
        const barcodeWidth = 168 * scale;  // 160 * 1.05
        const barcodeHeight = 31.5 * scale;  // 30 * 1.05

        barcodeCanvas.width = barcodeWidth;
        barcodeCanvas.height = barcodeHeight;

        // 创建临时的SVG元素用于生成条形码
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.id = 'temp-barcode';
        tempSvg.style.display = 'none';
        document.body.appendChild(tempSvg);

        // 生成条形码
        JsBarcode("#temp-barcode", lens.serial_number, {
            format: "CODE128",
            width: 1.575,  // 1.5 * 1.05
            height: barcodeHeight * 0.7,
            displayValue: true,
            fontSize: 10.5 * scale,  // 10 * 1.05
            textMargin: 2,
            margin: 0,
            textPosition: "top",
            textAlign: "center",
            angle: 180
        });

        // 获取生成的SVG元素
        const barcodeSvg = document.getElementById('temp-barcode');
        
        // 创建Image对象来加载SVG
        const barcodeImage = new Image();
        barcodeImage.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(barcodeSvg));
        
        // 当条形码图片加载完成后继续处理
        barcodeImage.onload = () => {
            const qrCanvas = document.createElement('canvas');
            qrCanvas.width = qrSize * 1.2;  // 增大20%
            qrCanvas.height = qrSize * 1.2;  // 增大20%

            QRCode.toCanvas(qrCanvas, qrContent, { 
                width: qrSize * 1.2, 
                height: qrSize * 1.2, 
                errorCorrectionLevel: 'H',  // 使用最高级别的错误纠正
                margin: 2,  // 增加边距
                color: {
                    dark: '#000000',  // 纯黑色
                    light: '#ffffff'  // 纯白色
                }
            }, (err) => {
                if (err) {
                    console.error('QR Code generation error:', err);
                    return;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(qrCanvas, qrX, qrY, qrSize * 1.2, qrSize * 1.2);

                // 绘制虚线
                ctx.setLineDash([10, 5]);
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, headerHeight);
                ctx.lineTo(canvasWidth, headerHeight);
                ctx.stroke();
                ctx.setLineDash([]);

                // 绘制上半区域（倒置）
                ctx.save();
                ctx.translate(canvasWidth, headerHeight);
                ctx.rotate(Math.PI);
                
                const fontSize = canvasWidth * 0.0473;  // 0.045 * 1.05
                const margin = 15 * scale;
                
                // 绘制产品名称（放大10%）
                ctx.font = `bold ${fontSize * 1.1}px SimHei`;
                ctx.textAlign = 'left';
                ctx.fillText(lens.product_name, margin, headerHeight - margin - fontSize * 2.5 + 15 * scale - 10);  // 上移6px

                // 绘制球镜和柱镜（缩小到70%）
                ctx.font = `bold ${fontSize * 1.05}px SimHei`;
                const sphericalText = `S:${lens.spherical}`;
                const cylinderText = `C:${lens.cylinder}`;
                const textWidth = ctx.measureText(sphericalText).width;
                ctx.fillText(sphericalText, margin, headerHeight - margin - fontSize * 1.4 + 15 * scale);
                ctx.fillText(cylinderText, margin + textWidth + margin * 2, headerHeight - margin - fontSize * 1.4 + 15 * scale);

                // 绘制正柱镜格式（保持与S、C相同大小）
                const positiveSpherical = (parseFloat(lens.spherical) + parseFloat(lens.cylinder) > 0 ? `+${formatLensValue(parseFloat(lens.spherical) + parseFloat(lens.cylinder))}` : formatLensValue(parseFloat(lens.spherical) + parseFloat(lens.cylinder)));
                const positiveCylinder = (parseFloat(-lens.cylinder) > 0 ? `+${formatLensValue(-lens.cylinder)}` : formatLensValue(-lens.cylinder));
                ctx.fillText(positiveSpherical, margin, headerHeight - margin - fontSize * 0.3 + 15 * scale);
                ctx.fillText(positiveCylinder, margin + textWidth + margin * 2, headerHeight - margin - fontSize * 0.3 + 15 * scale);

                // 绘制倒置的条形码（下移9个像素）
                const barcodeX = canvasWidth - barcodeWidth - margin * 2;
                const barcodeY = headerHeight - barcodeHeight - margin * 2 + 9 * scale + 15 * scale;  // 向下移动30px
                ctx.drawImage(barcodeImage, barcodeX, barcodeY, barcodeWidth, barcodeHeight);

                ctx.restore();

                // 下半部分内容
                const lowerFontSize = fontSize * 0.72;  // 再缩小20%
                ctx.font = `bold ${lowerFontSize * 1.2}px SimHei`;  // 产品名称字体
                const productNameY = headerHeight + lowerFontSize * 2;
                ctx.fillText(lens.product_name, canvasWidth * 0.05, productNameY);

                // 设置参数字体
                ctx.font = `${lowerFontSize * 0.9}px SimHei`;
                
                // 参数布局
                const leftX = canvasWidth * 0.05;
                const rightX = canvasWidth * 0.45;  // 两列基准间距
                const startY = productNameY + lowerFontSize * 2;
                const lineHeight = lowerFontSize * 1.5;

                // 为第一行和第二行创建特殊的右侧起始位置（间隔缩短一半）
                const specialRightX = canvasWidth * 0.33;  // 0.05 + (0.45-0.05)/2

                // 格式化生产日期，去掉"-"
                const formattedDate = lens.production_date.replace(/-/g, '');

                // 第一行（使用缩短的间隔）
                ctx.fillText(`直径: ${lens.diameter}`, leftX, startY);
                ctx.fillText(`中心厚度: ${lens.centerThickness}`, specialRightX, startY);

                // 第二行（使用缩短的间隔）
                ctx.fillText(`折射率: ${lens.refraction}`, leftX, startY + lineHeight);
                ctx.fillText(`阿贝数: ${lens.abbeNumber}`, specialRightX, startY + lineHeight);

                // 第三行
                ctx.fillText(`生产日期: ${formattedDate}`, leftX, startY + lineHeight * 2);

                // 第四行 - 膜层
                ctx.fillText(`膜层: ${lens.coating}`, leftX, startY + lineHeight * 3);
                ctx.fillText(`透射比: ${lens.transmittance}`, rightX, startY + lineHeight * 3);

                // 第五行 - 执行标准
                ctx.fillText(`执行标准: ${lens.standard}`, leftX, startY + lineHeight * 4);

                const img = new Image();
                img.src = canvas.toDataURL();
                img.width = 375;
                img.height = 250;
                img.style.margin = '5px';

                // 清理临时SVG元素
                document.body.removeChild(tempSvg);

                // 将图片添加到结果容器中
                resultsDiv.appendChild(img);

                callback(img);
            });
        };
    };

    // 辅助函数：格式化镜片值
    const formatLensValue = (value) => {
        return parseFloat(value).toFixed(2);
    };

    // 导出函数供外部使用
    window.group2Functions = {
        generateLensData: generateGroup2LensData,
        generateQRCode: generateStyle2QRCode
    };
}); 
