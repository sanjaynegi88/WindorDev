import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeLogInput } from '../common/utils/security.util';

@Injectable()
export class PdfService {
    private readonly brandTeal = '#1CA7A6';
    private readonly brandNavy = '#1F2A44';

    private getProjectRootAssetBase64(filename: string): string {
        try {
            const absolutePath = path.resolve(process.cwd(), filename);
            if (!fs.existsSync(absolutePath)) {
                console.warn(`PDF asset not found: ${absolutePath}`);
                return '';
            }
            const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
            const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
            const base64Data = fs.readFileSync(absolutePath, 'base64');
            return `data:${mimeType};base64,${base64Data}`;
        } catch (e) {
            console.error(`Failed to load PDF asset ${filename}:`, e);
            return '';
        }
    }

    private getPdfBrandingAssets(): { logo: string; background: string } {
        return {
            logo: this.getProjectRootAssetBase64('logo.png'),
            background: this.getProjectRootAssetBase64('login-bg.png'),
        };
    }

    private getMaintenanceReportLogo(): string {
        return this.getProjectRootAssetBase64('updated_logo.png') || this.getProjectRootAssetBase64('logo.png');
    }

    private escapeHtml(value: unknown): string {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private getSharedPdfStyles(backgroundDataUrl: string): string {
        return `
            @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap');

            @page {
                size: A4;
                margin: 0;
            }

            * { box-sizing: border-box; }

            html, body {
                margin: 0;
                padding: 0;
                font-family: 'Open Sans', Arial, Helvetica, sans-serif;
                color: ${this.brandNavy};
                line-height: 1.55;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .pdf-bg {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 0;
                background-image: url('${backgroundDataUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }

            .pdf-page {
                position: relative;
                z-index: 1;
                min-height: 100vh;
                padding: 22px 40px 44px;
            }

            .pdf-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 28px;
                padding-top: 6px;
                page-break-inside: avoid;
            }

            .pdf-logo {
                height: 54px;
                width: auto;
                object-fit: contain;
                display: block;
            }

            .pdf-brand {
                font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 22px;
                font-weight: 400;
                letter-spacing: 0.06em;
                line-height: 1.1;
                text-align: right;
                padding-top: 10px;
                white-space: nowrap;
                text-transform: uppercase;
            }

            .brand-windor { color: ${this.brandTeal}; }
            .brand-verification { color: ${this.brandNavy}; }

            .section-title-row {
                display: flex;
                align-items: center;
                gap: 14px;
                margin: 0 0 14px;
                page-break-inside: avoid;
            }

            .section-title-row .section-title-left,
            .section-title-row .section-title-right {
                font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 13px;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: ${this.brandNavy};
                margin: 0;
                white-space: nowrap;
            }

            .section-title-row .section-title-right {
                text-align: right;
                font-weight: 400;
                letter-spacing: 0.06em;
                color: rgba(31, 42, 68, 0.75);
            }

            .section-title-row .section-title-line {
                flex: 1;
                height: 1px;
                background: rgba(28, 167, 166, 0.35);
                min-width: 24px;
            }

            .content-panel {
                background: rgba(255, 255, 255, 0.94);
                border: 1px solid rgba(31, 42, 68, 0.1);
                border-radius: 14px;
                box-shadow: 0 8px 24px rgba(31, 42, 68, 0.06);
                padding: 22px 24px;
                margin-bottom: 22px;
                page-break-inside: avoid;
            }

            .section-title {
                font-size: 13px;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: ${this.brandNavy};
                margin: 0 0 14px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .section-title::after {
                content: '';
                flex: 1;
                height: 1px;
                background: rgba(28, 167, 166, 0.35);
            }

            .property-main-title {
                font-size: 24px;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: ${this.brandNavy};
                margin: 0 0 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                gap: 16px;
            }

            .property-main-title::before,
            .property-main-title::after {
                content: '';
                flex: 1;
                height: 2px;
                background: rgba(28, 167, 166, 0.35);
            }

            .property-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px 24px;
            }

            .info-group { display: flex; flex-direction: column; gap: 4px; }

            .info-label {
                font-size: 10px;
                font-weight: 400;
                color: rgba(31, 42, 68, 0.55);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }

            .info-value {
                font-size: 14px;
                font-weight: 400;
                color: ${this.brandNavy};
                word-break: break-word;
            }

            .summary-banner {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 24px;
            }

            .stat-box {
                background: linear-gradient(135deg, ${this.brandNavy} 0%, #2d3f63 100%);
                color: #fff;
                border-radius: 12px;
                padding: 18px 14px;
                text-align: center;
            }

            .stat-box h4 {
                margin: 0 0 4px;
                font-size: 26px;
                font-weight: 400;
                line-height: 1;
            }

            .stat-box p {
                margin: 0;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                opacity: 0.85;
            }

            .filter-banner {
                background: rgba(28, 167, 166, 0.1);
                border-left: 4px solid ${this.brandTeal};
                border-radius: 10px;
                padding: 14px 18px;
                margin-bottom: 22px;
                font-size: 13px;
                color: ${this.brandNavy};
            }

            .property-block {
                margin-bottom: 36px;
                page-break-before: always;
                padding-top: 28px;
            }

            .property-block.first-property {
                page-break-before: auto;
                padding-top: 0;
            }

            .project-section {
                page-break-before: always;
                padding-top: 32px;
                margin-bottom: 8px;
            }

            .project-section.first-project {
                page-break-before: auto;
                padding-top: 0;
            }

            .project-card {
                background: rgba(255, 255, 255, 0.96);
                border: 2px solid rgba(28, 167, 166, 0.28);
                border-radius: 14px;
                overflow: hidden;
                margin-bottom: 18px;
                page-break-inside: avoid;
                break-inside: avoid;
                page-break-before: auto;
            }

            .project-card .project-head {
                background: linear-gradient(90deg, rgba(28, 167, 166, 0.2) 0%, rgba(31, 42, 68, 0.08) 100%);
                padding: 16px 22px;
                border-bottom: 1px solid rgba(31, 42, 68, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .project-card .project-head h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: ${this.brandNavy};
            }

            .project-card .project-head .project-subtitle {
                font-size: 11px;
                font-weight: 400;
                color: rgba(31, 42, 68, 0.6);
                margin-top: 4px;
                text-transform: none;
                letter-spacing: 0;
            }

            .components-under-project {
                margin: 0 0 8px 0;
                padding: 0 4px;
            }

            .component-card {
                border: 1px solid rgba(31, 42, 68, 0.12);
                border-radius: 12px;
                overflow: hidden;
                margin-bottom: 16px;
                background: rgba(255, 255, 255, 0.98);
                page-break-inside: avoid;
                break-inside: avoid;
                page-break-before: auto;
                min-height: 200px;
            }

            .component-head {
                background: rgba(31, 42, 68, 0.06);
                padding: 12px 18px;
                border-bottom: 1px solid rgba(31, 42, 68, 0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .component-head h3 {
                margin: 0;
                font-size: 15px;
                font-weight: 400;
                color: ${this.brandNavy};
            }

            .component-body { padding: 20px; }

            .field-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 14px 18px;
                margin-bottom: 14px;
            }

            .nested-section-label {
                font-size: 11px;
                font-weight: 400;
                color: rgba(31, 42, 68, 0.6);
                text-transform: uppercase;
                letter-spacing: 0.06em;
                margin: 8px 0 12px 8px;
            }

            .image-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 14px;
                margin-top: 12px;
            }

            .image-grid.compact {
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
            }

            .image-item {
                border-radius: 8px;
                border: 1px solid rgba(31, 42, 68, 0.1);
                background: #f8fafc;
                padding: 8px;
            }

            .image-item img {
                width: 100%;
                height: 150px;
                object-fit: cover;
                border-radius: 6px;
                display: block;
            }

            .image-grid.compact .image-item img { height: 90px; }

            .image-tag {
                font-size: 9px;
                color: rgba(31, 42, 68, 0.65);
                margin-top: 6px;
                text-align: center;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .photo-section-label {
                font-size: 10px;
                font-weight: 400;
                color: rgba(31, 42, 68, 0.55);
                text-transform: uppercase;
                letter-spacing: 0.06em;
                margin: 16px 0 8px;
            }

            .status-badge {
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 400;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                white-space: nowrap;
            }

            .status-verified { background: #dcfce7; color: #15803d; }
            .status-unverified { background: #fef3c7; color: #d97706; }
            .status-ready { background: #dcfce7; color: #15803d; }
            .status-wait { background: #fee2e2; color: #b91c1c; }

            .empty-state {
                background: rgba(255, 255, 255, 0.9);
                border: 1px dashed rgba(31, 42, 68, 0.2);
                border-radius: 10px;
                padding: 18px;
                text-align: center;
                color: rgba(31, 42, 68, 0.55);
                font-size: 13px;
                margin-bottom: 18px;
            }

            .pdf-footer {
                margin-top: 28px;
                padding-top: 12px;
                border-top: 1px solid rgba(31, 42, 68, 0.12);
                font-size: 10px;
                color: rgba(31, 42, 68, 0.5);
                text-align: center;
            }
        `;
    }

    private buildPdfHeader(): string {
        const { logo } = this.getPdfBrandingAssets();
        const logoHtml = logo ? `<img src="${logo}" alt="Windor" class="pdf-logo" />` : '';

        return `
            <header class="pdf-header">
                <div>${logoHtml}</div>
                <div class="pdf-brand">
                    <span class="brand-windor">WINDOR</span><span class="brand-verification"> VERIFICATION</span>
                </div>
            </header>
        `;
    }

    private formatReportDate(date: Date = new Date()): string {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    }

    private formatReportDateTime(date: Date = new Date()): string {
        return date.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    private formatInstallDate(value: unknown): string {
        if (!value) return '';
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) return '';
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    private getComponentBrandName(component: any): string {
        return component.brand || component.other_brand || '';
    }

    private getWhereInstall(component: any): string {
        return component.type || '';
    }

    private getMaintenanceReportStyles(): string {
        return `
            @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap');
            @page { size: A4; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
                margin: 0;
                padding: 0;
                font-family: 'Open Sans', Arial, Helvetica, sans-serif;
                color: #000;
                font-size: 11px;
                line-height: 1.4;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .doc-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #fff;
                padding: 14px 40px 0;
                z-index: 1000;
            }
            .doc-header-grid {
                display: grid;
                grid-template-columns: 1fr auto;
                grid-template-rows: auto auto auto auto;
                column-gap: 24px;
                row-gap: 0;
            }
            .doc-header-url {
                grid-column: 2;
                grid-row: 1;
                text-align: right;
                font-size: 11px;
                align-self: start;
            }
            .doc-header-brand {
                grid-column: 1;
                grid-row: 1 / 3;
                align-self: start;
            }
            .doc-header-logo {
                height: 64px;
                width: auto;
                display: block;
            }
            .doc-header-right-spacer {
                grid-column: 2;
                grid-row: 2;
                min-height: 28px;
            }
            .doc-header-line {
                grid-column: 1 / -1;
                grid-row: 3;
                border: none;
                border-top: 1px solid #000;
                margin: 10px 0 8px;
            }
            .doc-header-company-block {
                grid-column: 1;
                grid-row: 4;
                align-self: start;
            }
            .doc-header-company {
                font-weight: 400;
                font-size: 10.5px;
                line-height: 1.3;
            }
            .doc-header-country {
                font-size: 10.5px;
                font-weight: 400;
                margin-top: 2px;
            }
            .doc-header-time {
                grid-column: 2;
                grid-row: 4;
                text-align: right;
                font-size: 11px;
                white-space: nowrap;
                align-self: start;
            }
            .doc-content {
                padding: 0;
            }
            .component-section:last-child {
                margin-bottom: 0;
            }
            .maintenance-body {
                padding: 0 40px;
            }
            .property-report-block .maintenance-body {
                padding-top: 72px;
            }
            .report-title-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 24px;
                page-break-inside: avoid;
            }
            .report-title {
                font-size: 26px;
                font-weight: 400;
                line-height: 1.15;
                margin: 0;
                text-align: left;
                flex: 1;
            }
            .report-images {
                display: flex;
                gap: 10px;
                flex-shrink: 0;
                justify-content: flex-end;
            }
            .report-image-slot {
                width: 110px;
                height: 110px;
                border: 1px solid #bbb;
                background: #fff;
                overflow: hidden;
            }
            .report-image-slot img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .report-address {
                margin-top: 40px;
                page-break-inside: avoid;
            }
            .report-address .address-line {
                font-size: 17.5px;
                font-weight: 400;
                margin: 0;
                line-height: 1.35;
            }
            .report-address .city-line {
                font-size: 16px;
                font-weight: 400;
                margin: 12px 0 0;
                line-height: 1.35;
            }
            .report-address .zip-line {
                font-size: 16px;
                font-weight: 400;
                margin: 2px 0 0;
                line-height: 1.35;
            }
            .report-sections {
                margin-top: 32px;
            }
            .component-section {
                margin-bottom: 16px;
                page-break-inside: avoid;
                break-inside: avoid;
                orphans: 2;
                widows: 2;
            }
            .component-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                page-break-inside: avoid;
                page-break-after: avoid;
                break-after: avoid;
            }
            .component-section-title {
                font-size: 15.3px;
                font-weight: 400;
                margin: 0;
                white-space: nowrap;
                flex: 1;
                align-self: center;
            }
            .component-thumbnails {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: flex-end;
                align-self: center;
            }
            .component-thumbnail {
                width: 44px;
                height: 44px;
                border: 1px solid #e2e8f0;
                border-radius: 3px;
                background: #ffffff;
                padding: 3px;
                flex-shrink: 0;
                box-sizing: border-box;
            }
            .component-thumbnail img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                border-radius: 1px;
            }
            .component-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-family: 'Open Sans', Arial, Helvetica, sans-serif;
                page-break-inside: avoid;
                break-inside: avoid;
                margin-top: 0px;
            }
            .component-table thead th {
                background: #fff;
                font-weight: 600;
                font-size: 9px;
                text-align: left;
                padding: 7px 5px;
                border: 1px solid #f1f1f1;
                vertical-align: bottom;
                word-wrap: break-word;
            }
            .component-table thead tr {
                border-bottom: 2px solid #000;
                page-break-inside: avoid;
                page-break-after: avoid;
                break-after: avoid;
            }
            .component-table tbody td {
                padding: 7px 5px;
                border: 1px solid #f1f1f1;
                vertical-align: top;
                word-wrap: break-word;
                background: #fff;
                font-size: 9px;
                font-weight: 400;
            }
            .component-table tbody tr {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .property-report-block {
                page-break-before: always;
            }
            .property-report-block.first-property {
                page-break-before: auto;
            }
            .paywall-note {
                margin: 0 40px 20px;
                padding: 10px 12px;
                border: 1px solid #ccc;
                font-size: 11px;
                page-break-inside: avoid;
            }
        `;
    }

    private buildInDocumentHeaderHtml(): string {
        const logo = this.getMaintenanceReportLogo();
        const reportDateTime = this.formatReportDateTime();
        const logoImg = logo
            ? `<img src="${logo}" class="doc-header-logo" alt="Windor" />`
            : '';

        return `
            <header class="doc-header">
                <div class="doc-header-grid">
                    <div class="doc-header-url">www.windor.app</div>
                    <div class="doc-header-brand">${logoImg}</div>
                    <div class="doc-header-right-spacer"></div>
                    <hr class="doc-header-line" />
                    <div class="doc-header-company-block">
                        <div class="doc-header-company">Windor LLC</div>
                        <div class="doc-header-country">United States</div>
                    </div>
                    <div class="doc-header-time">Report Printed: ${this.escapeHtml(reportDateTime)}</div>
                </div>
            </header>
        `;
    }

    private buildMaintenanceFooterTemplate(): string {
        return `
            <div style="width:100%;font-family:'Open Sans',Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:0 40px 12px;margin:0;">
                <hr style="border:none;border-top:1px solid #000;margin:0 0 8px;" />
                <div style="text-align:center;">Page: <span class="pageNumber"></span> / <span class="totalPages"></span></div>
            </div>
        `;
    }

    private async buildPropertyImagesHtml(frontImage?: string | null, otherImage?: string | null): Promise<string> {
        const imageEntries: { url: string; label: string }[] = [];
        if (otherImage) {
            imageEntries.push({ url: otherImage, label: 'Other Image' });
        }
        if (frontImage) {
            imageEntries.push({ url: frontImage, label: 'Front Image' });
        }

        if (imageEntries.length === 0) {
            return '';
        }

        const images = (
            await Promise.all(
                imageEntries.map(async (entry) => ({
                    src: await this.getBase64Image(entry.url),
                    label: entry.label,
                })),
            )
        ).filter((image) => !!image.src);

        if (images.length === 0) {
            return '';
        }

        return `
            <div class="report-images">
                ${images
                    .map(
                        (image) => `
                    <div class="report-image-slot">
                        <img src="${image.src}" alt="${this.escapeHtml(image.label)}" />
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    }

    private buildAddressHtml(propertyData: any): string {
        const addressLines: string[] = [];
        if (propertyData.address) {
            addressLines.push(`<p class="address-line">${this.escapeHtml(propertyData.address)}</p>`);
        }

        const cityName = propertyData.city?.name || propertyData.city_name || '';
        const zip = propertyData.zip || '';

        return `
            <div class="report-address">
                ${addressLines.join('')}
                ${cityName ? `<p class="city-line">${this.escapeHtml(cityName)}</p>` : ''}
                ${zip ? `<p class="zip-line">${this.escapeHtml(zip)}</p>` : ''}
            </div>
        `;
    }

    private getComponentTableConfig(componentType: string): { title: string; columns: { label: string; getValue: (c: any) => string }[] } | null {
        const commonColumns = [
            { label: 'Description', getValue: (c: any) => c.description || '' },
            { label: 'Install Date', getValue: (c: any) => this.formatInstallDate(c.install_date) },
            { label: 'Where Install', getValue: (c: any) => c.where_install || '' },
            { label: 'Supplier/Dealer', getValue: (c: any) => c.supplier || '' },
            { label: 'Contractor', getValue: (c: any) => c.contractor_company_name || '' },
        ];

        const configs: Record<string, { title: string; columns: { label: string; getValue: (c: any) => string }[] }> = {
            SIDING: {
                title: 'Siding Data Info',
                columns: [
                    ...commonColumns,
                    { label: 'Siding Material', getValue: (c: any) => c.material || '' },
                    { label: 'Siding Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                    { label: 'Siding Style', getValue: (c: any) => c.style || '' },
                    { label: 'Siding Color', getValue: (c: any) => c.color || '' },
                    { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
                ],
            },
            WINDOWS: {
                title: 'Window Data Info',
                columns: [
                    ...commonColumns,
                    { label: 'Window Material', getValue: (c: any) => c.material || '' },
                    { label: 'Window Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                    { label: 'Window Production Line', getValue: (c: any) => c.production_line || '' },
                    { label: 'Window serial/Order number', getValue: (c: any) => c.order_number || '' },
                    { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
                ],
            },
            ROOFING: {
                title: 'Roofing Data Info',
                columns: [
                    ...commonColumns,
                    { label: 'Roof Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                    { label: 'Roof Style', getValue: (c: any) => c.style || '' },
                    { label: 'Roof Color', getValue: (c: any) => c.color || '' },
                    { label: 'Roof Material', getValue: (c: any) => c.material || '' },
                    {
                        label: 'Impact resistant',
                        getValue: (c: any) => (c.impact_resistant === true ? 'Yes' : c.impact_resistant === false ? 'No' : ''),
                    },
                    { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
                ],
            },
            DOORS: {
                title: 'Door Data Info',
                columns: [
                    ...commonColumns,
                    { label: 'Door Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                    { label: 'Door Code', getValue: (c: any) => c.door_code || '' },
                    { label: 'Door Material', getValue: (c: any) => c.material || '' },
                    { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
                ],
            },
            GARAGE_DOORS: {
                title: 'Garage Door Data Info',
                columns: [
                    ...commonColumns,
                    { label: 'Garage Door Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                    { label: 'Garage Door Code', getValue: (c: any) => c.windcode || '' },
                    { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
                ],
            },
        };

        if (configs[componentType]) {
            return configs[componentType];
        }

        // Generic configuration for Homeowner Projects (e.g., NEW_AC, NEW_CABINETS)
        const formattedTitle = componentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) + ' Data Info';
        return {
            title: formattedTitle,
            columns: [
                ...commonColumns,
                { label: 'Brand', getValue: (c: any) => this.getComponentBrandName(c) },
                { label: 'Manufacturer', getValue: (c: any) => c.manufacturer || '' },
            ],
        };
    }

    private async buildComponentThumbnailsHtml(components: any[]): Promise<string> {
        const imageUrls: string[] = [];
        components.forEach((component) => {
            (component.images || []).forEach((image: any) => {
                if (image.image_url) {
                    imageUrls.push(image.image_url);
                }
            });
        });

        console.log(`[PDF] buildComponentThumbnailsHtml: ${components.length} components, ${imageUrls.length} image URLs found`);
        if (imageUrls.length > 0) {
            console.log(`[PDF] Sample image URL: ${imageUrls[0]}`);
        }

        if (imageUrls.length === 0) {
            return '';
        }

        const thumbnails = (
            await Promise.all(
                imageUrls.map(async (url) => {
                    const src = await this.getBase64Image(url);
                    if (!src) console.warn(`[PDF] Failed to convert image to base64: ${url}`);
                    return { src };
                }),
            )
        ).filter((item) => !!item.src);

        console.log(`[PDF] Successfully converted ${thumbnails.length}/${imageUrls.length} images to base64`);

        if (thumbnails.length === 0) {
            return '';
        }

        return `
            <div class="component-thumbnails">
                ${thumbnails
                    .map(
                        (item) => `
                    <div class="component-thumbnail">
                        <img src="${item.src}" alt="Component" />
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    }

    private async buildComponentSectionHtml(componentType: string, components: any[], isFirstSection = false): Promise<string> {
        const config = this.getComponentTableConfig(componentType);
        if (!config || components.length === 0) {
            return '';
        }

        const headerCells = config.columns
            .map((col) => `<th>${this.escapeHtml(col.label)}</th>`)
            .join('');

        const bodyRows = components
            .map((component) => {
                const cells = config.columns
                    .map((col) => `<td>${this.escapeHtml(col.getValue(component))}</td>`)
                    .join('');
                return `<tr>${cells}</tr>`;
            })
            .join('');

        const thumbnailsHtml = await this.buildComponentThumbnailsHtml(components);
        const pageBreakStyle = !isFirstSection ? 'style="page-break-before: auto;"' : '';

        return `
            <section class="component-section" ${pageBreakStyle}>
                <div class="component-section-header">
                    <h2 class="component-section-title">${this.escapeHtml(config.title)}</h2>
                    ${thumbnailsHtml}
                </div>
                <div>
                    <table class="component-table">
                        <thead><tr>${headerCells}</tr></thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
            </section>
        `;
    }

    private async buildMaintenanceReportBody(propertyData: any, isFirstProperty = true): Promise<string> {
        const components: any[] = propertyData.components || [];
        console.log(`[PDF] buildMaintenanceReportBody: propertyId=${propertyData.id}, components=${components.length}, front_image=${!!propertyData.front_image}`);
        if (components.length > 0) {
            console.log(`[PDF] Component types: ${[...new Set(components.map((c: any) => c.component_type))].join(', ')}`);
            console.log(`[PDF] First component images count: ${(components[0].images || []).length}`);
        }
        const componentsByType = new Map<string, any[]>();

        components.forEach((component) => {
            const type = component.component_type;
            if (!type) return;
            if (!componentsByType.has(type)) {
                componentsByType.set(type, []);
            }
            componentsByType.get(type)!.push(component);
        });

        const contractorOrder = ['SIDING', 'WINDOWS', 'ROOFING', 'DOORS', 'GARAGE_DOORS'];
        const otherTypes = Array.from(componentsByType.keys()).filter(t => !contractorOrder.includes(t));
        const sectionOrder = [...contractorOrder, ...otherTypes];
        
        const sections: string[] = [];
        
        for (let i = 0; i < sectionOrder.length; i++) {
            const type = sectionOrder[i];
            const typeComponents = componentsByType.get(type);
            if (typeComponents && typeComponents.length > 0) {
                const sectionHtml = await this.buildComponentSectionHtml(type, typeComponents, i === 0);
                if (sectionHtml) {
                    sections.push(sectionHtml);
                }
            }
        }
        
        const sectionsHtml = sections.join('');

        const blockClass = isFirstProperty ? 'property-report-block first-property' : 'property-report-block';
        const propertyImagesHtml = await this.buildPropertyImagesHtml(
            propertyData.front_image,
            propertyData.other_image,
        );

        return `
            <div class="${blockClass}">
                <div class="maintenance-body">
                    <div class="report-title-row">
                        <h1 class="report-title">Property Maintenance Report</h1>
                        ${propertyImagesHtml}
                    </div>
                    ${this.buildAddressHtml(propertyData)}
                    <div class="report-sections">
                        ${sectionsHtml || '<p style="color:#666;font-size:12px;">No component data available for this report.</p>'}
                    </div>
                </div>
            </div>
        `;
    }

    private async buildMaintenanceReportDocument(propertyData: any): Promise<string> {
        return this.buildMultiPropertyMaintenanceReportDocument([propertyData]);
    }

    private async buildMultiPropertyMaintenanceReportDocument(
        propertiesData: any[],
        paywall?: { lockedCount: number; totalAmountDue: number },
    ): Promise<string> {
        const paywallHtml =
            paywall && paywall.lockedCount > 0
                ? `<div class="paywall-note"><strong>Access Note:</strong> ${paywall.lockedCount} additional propert${paywall.lockedCount === 1 ? 'y is' : 'ies are'} available with payment ($${paywall.totalAmountDue?.toFixed(2) ?? '0.00'} due).</div>`
                : '';

        const propertiesHtml = (
            await Promise.all(
                propertiesData.map((property, index) => this.buildMaintenanceReportBody(property, index === 0)),
            )
        ).join('');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>${this.getMaintenanceReportStyles()}</style>
        </head>
        <body>
            ${this.buildInDocumentHeaderHtml()}
            <table style="width: 100%; border: none; border-collapse: collapse; margin: 0; padding: 0; table-layout: fixed;">
                <thead style="display: table-header-group; border: none; margin: 0; padding: 0;">
                    <tr><td style="height: 170px; border: none; padding: 0; margin: 0;"></td></tr>
                </thead>
                <tbody style="border: none; margin: 0; padding: 0;">
                    <tr><td style="border: none; padding: 0; margin: 0;">
                        <div class="doc-content">
                            ${paywallHtml}
                            ${propertiesHtml}
                        </div>
                    </td></tr>
                </tbody>
                <tfoot style="display: table-footer-group; border: none; margin: 0; padding: 0;">
                    <tr><td style="height: 60px; border: none; padding: 0; margin: 0;"></td></tr>
                </tfoot>
            </table>
        </body>
        </html>
        `;
    }

    private async renderMaintenancePdf(
        htmlTemplate: string,
        options?: { pageTimeout?: number; pdfTimeout?: number },
    ): Promise<Buffer> {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-zygote',
                    '--no-first-run',
                    '--disable-accelerated-2d-canvas',
                    '--memory-pressure-off',
                ],
                timeout: 60000,
            });

            const page = await browser.newPage();
            const pageTimeout = options?.pageTimeout ?? 60000;
            page.setDefaultTimeout(pageTimeout);
            await page.setViewport({ width: 1200, height: 800 });

            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0',
                timeout: pageTimeout,
            });
            await page.evaluateHandle('document.fonts.ready');

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: this.buildMaintenanceFooterTemplate(),
                margin: { top: '0', bottom: '52px', left: '0', right: '0' },
                preferCSSPageSize: true,
                timeout: options?.pdfTimeout,
            });

            return Buffer.from(pdfBuffer);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (closeError) {
                    console.error('Error closing browser:', closeError);
                }
            }
        }
    }

    private buildSectionTitleRow(leftLabel: string, rightLabel: string): string {
        return `
            <div class="section-title-row">
                <span class="section-title-left">${this.escapeHtml(leftLabel)}</span>
                <span class="section-title-line"></span>
                <span class="section-title-right">${this.escapeHtml(rightLabel)}</span>
            </div>
        `;
    }

    private buildPdfDocument(content: string): string {
        const { background } = this.getPdfBrandingAssets();

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>${this.getSharedPdfStyles(background)}</style>
        </head>
        <body>
            <div class="pdf-bg"></div>
            <div class="pdf-page">
                ${this.buildPdfHeader()}
                ${content}
                <div class="pdf-footer">WINDOR VERIFICATION &bull; Confidential Property Report</div>
            </div>
        </body>
        </html>
        `;
    }

    async generatePropertyReport(propertyData: any): Promise<Buffer> {
        try {
            const htmlTemplate = await this.buildHTMLTemplate(propertyData);
            return await this.renderMaintenancePdf(htmlTemplate);
        } catch (error) {
            console.error('PDF Service Property Report Error:', error.message);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    private guessImageMimeType(source: string): string {
        const ext = path.extname(source.split('?')[0]).toLowerCase();
        if (ext === '.png') return 'image/png';
        if (ext === '.gif') return 'image/gif';
        if (ext === '.svg') return 'image/svg+xml';
        if (ext === '.webp') return 'image/webp';
        return 'image/jpeg';
    }

    private async getBase64Image(imageUrl: string): Promise<string> {
        if (!imageUrl) return '';
        try {
            if (imageUrl.startsWith('data:')) {
                return imageUrl;
            }

            let relativePath = imageUrl;
            if (process.env.BASE_URL && relativePath.startsWith(process.env.BASE_URL)) {
                relativePath = relativePath.substring(process.env.BASE_URL.length);
            }

            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }

            const absolutePath = path.resolve(relativePath);
            if (fs.existsSync(absolutePath)) {
                const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
                const mimeType =
                    ext === 'png'
                        ? 'image/png'
                        : ext === 'gif'
                          ? 'image/gif'
                          : ext === 'svg'
                            ? 'image/svg+xml'
                            : ext === 'webp'
                              ? 'image/webp'
                              : 'image/jpeg';
                const base64Data = fs.readFileSync(absolutePath, 'base64');
                return `data:${mimeType};base64,${base64Data}`;
            }

            const remoteUrl = imageUrl.startsWith('http')
                ? imageUrl
                : `${process.env.BASE_URL || ''}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

            if (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://')) {
                const response = await fetch(remoteUrl);
                if (!response.ok) {
                    console.warn(`Failed to fetch image (${response.status}): ${remoteUrl}`);
                    return '';
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                const contentType =
                    response.headers.get('content-type')?.split(';')[0] || this.guessImageMimeType(remoteUrl);
                return `data:${contentType};base64,${buffer.toString('base64')}`;
            }
        } catch (e) {
            console.error(`Failed to convert image to base64: ${imageUrl}`, e);
        }

        return '';
    }

    async generateSummaryReport(propertiesData: any[], _filters: any, paywall?: { lockedCount: number; totalAmountDue: number }): Promise<Buffer> {
        try {
            console.log(`Starting PDF generation for ${sanitizeLogInput(propertiesData.length)} properties`);

            const htmlTemplate = await this.buildMultiPropertyMaintenanceReportDocument(propertiesData, paywall);
            console.log('Maintenance report HTML template built successfully');

            const pdfBuffer = await this.renderMaintenancePdf(htmlTemplate, {
                pageTimeout: 180000,
                pdfTimeout: 240000,
            });
            console.log('PDF generated successfully');

            return pdfBuffer;
        } catch (error) {
            console.error('PDF Service Error:', error.message);

            if (error.message?.includes('Navigation timeout') || error.message?.includes('timeout')) {
                throw new Error(`PDF generation timeout: ${error.message}`);
            }

            if (error.message?.includes('memory') || error.message?.includes('heap')) {
                throw new Error(`Memory limit exceeded during PDF generation: ${error.message}`);
            }

            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    private async buildHTMLTemplate(propertyData: any): Promise<string> {
        return this.buildMaintenanceReportDocument(propertyData);
    }

    private buildSummaryHTMLTemplate(propertiesData: any[], filters: any, paywall?: { lockedCount: number; totalAmountDue: number }): string {
        const filterInfo: string[] = [];
        if (filters.brandName) filterInfo.push(`Brand: "${filters.brandName}"`);
        if (filters.style) filterInfo.push(`Style: "${filters.style}"`);
        if (filters.color) filterInfo.push(`Color: "${filters.color}"`);
        if (filters.search) filterInfo.push(`Search: "${filters.search}"`);
        const filterStr = filterInfo.length > 0 ? filterInfo.join(', ') : 'All Entities';
        const reportDate = this.formatReportDate();
        const summaryTitleRight = `COMPONENTS SUMMARY REPORT  ${reportDate}`;

        const paywallHtml =
            paywall && paywall.lockedCount > 0
                ? `<div class="filter-banner"><strong>Access Note:</strong> ${paywall.lockedCount} additional propert${paywall.lockedCount === 1 ? 'y is' : 'ies are'} available with payment ($${paywall.totalAmountDue?.toFixed(2) ?? '0.00'} due).</div>`
                : '';

        const propertiesHtml = propertiesData
            .map((property, index) =>
                this.buildSummaryPropertyBlock(property, index, propertiesData.length),
            )
            .join('');

        const content = `
            <div class="filter-banner"><strong>Search Filters:</strong> ${this.escapeHtml(filterStr)}</div>
            ${paywallHtml}
            ${this.buildSectionTitleRow(`Found Properties (${propertiesData.length})`, summaryTitleRight)}
            ${propertiesHtml || '<div class="empty-state">No properties matched the selected filters.</div>'}
        `;

        return this.buildPdfDocument(content);
    }

    private buildSummaryPropertyBlock(property: any, propertyIndex = 0, totalProperties = 1): string {
        const blockClass = propertyIndex === 0 ? 'property-block first-property' : 'property-block';
        return `
            <div class="${blockClass}">
                <h2 class="property-main-title">${this.escapeHtml(property.property_name || property.parcel_id || 'Property')}</h2>
                <div class="content-panel">
                    <div class="property-grid">
                        <div class="info-group">
                            <span class="info-label">Parcel ID</span>
                            <span class="info-value">${this.escapeHtml(property.parcel_id || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Property Name</span>
                            <span class="info-value">${this.escapeHtml(property.property_name || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Property Type</span>
                            <span class="info-value">${this.escapeHtml(property.property_type?.type_name || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Address</span>
                            <span class="info-value">${this.escapeHtml(property.address || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">City</span>
                            <span class="info-value">${this.escapeHtml(property.city_name || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Year Built</span>
                            <span class="info-value">${this.escapeHtml(property.yearbuilt || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Square Footage</span>
                            <span class="info-value">${property.square_foot ? this.escapeHtml(`${property.square_foot.toLocaleString()} sq ft`) : 'N/A'}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Owner Email</span>
                            <span class="info-value">${this.escapeHtml(property.owner_email || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Created At</span>
                            <span class="info-value">${property.created_at ? this.escapeHtml(new Date(property.created_at).toLocaleDateString()) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                ${this.generateProjectsWithComponentsHTML(property.projects || [], property.components || [])}
            </div>
        `;
    }

    private getTotalImages(components: any[]): number {
        return components.reduce((total, component) => {
            return total + (component.images ? component.images.length : 0);
        }, 0);
    }

    private buildProjectDetailsCard(project: any): string {
        const contractorName =
            project.contractor?.first_name && project.contractor?.last_name
                ? `${project.contractor.first_name} ${project.contractor.last_name}`
                : 'N/A';
        const createdByName =
            project.createdBy?.first_name && project.createdBy?.last_name
                ? `${project.createdBy.first_name} ${project.createdBy.last_name}`
                : 'N/A';
        const permitStatus = project.permit_upload?.status || project.permit_status || 'N/A';

        return `
            <div class="project-card">
                <div class="project-head">
                    <div>
                        <h3>${this.escapeHtml(project.project_type || 'Project')}</h3>
                        ${project.project_name ? `<div class="project-subtitle">${this.escapeHtml(project.project_name)}</div>` : ''}
                    </div>
                    <span class="status-badge ${project.project_status === 'COMPLETE' ? 'status-verified' : 'status-unverified'}">
                        ${this.escapeHtml(project.project_status || 'DRAFT')}
                    </span>
                </div>
                <div class="component-body">
                    <div class="field-grid">
                        <div class="info-group">
                            <span class="info-label">Project Type</span>
                            <span class="info-value">${this.escapeHtml(project.project_type || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Date of Install</span>
                            <span class="info-value">${project.date_of_install ? this.escapeHtml(new Date(project.date_of_install).toLocaleDateString()) : 'N/A'}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Permit Number</span>
                            <span class="info-value">${this.escapeHtml(project.permit || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Permit Status</span>
                            <span class="info-value">${this.escapeHtml(permitStatus)}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Contractor</span>
                            <span class="info-value">${this.escapeHtml(contractorName)}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Created By</span>
                            <span class="info-value">${this.escapeHtml(createdByName)}</span>
                        </div>
                    </div>
                    ${project.notes ? `
                        <div class="info-group" style="margin-top: 14px;">
                            <span class="info-label">Project Notes</span>
                            <span class="info-value" style="font-weight: 400; font-size: 13px;">${this.escapeHtml(project.notes)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    private generateProjectsWithComponentsHTML(
        projects: any[],
        components: any[],
        showProjectsSectionTitle = false,
    ): string {
        const safeProjects = projects || [];
        const safeComponents = components || [];

        if (safeProjects.length === 0) {
            if (safeComponents.length > 0) {
                return `
                    ${showProjectsSectionTitle ? '<h2 class="section-title">Component Details</h2>' : ''}
                    ${this.generateComponentsHTML(safeComponents)}
                `;
            }
            return '<div class="empty-state">No property projects found.</div>';
        }

        const componentsByProject = new Map<string, any[]>();
        const unassignedComponents: any[] = [];

        safeComponents.forEach((component) => {
            if (component.project_id) {
                if (!componentsByProject.has(component.project_id)) {
                    componentsByProject.set(component.project_id, []);
                }
                componentsByProject.get(component.project_id)!.push(component);
            } else {
                unassignedComponents.push(component);
            }
        });

        const projectsHtml = safeProjects
            .map((project, index) => {
                const projectComponents = componentsByProject.get(project.id) || [];
                const sectionClass = index === 0 ? 'project-section first-project' : 'project-section';

                return `
                    <section class="${sectionClass}">
                        ${this.buildSectionTitleRow('Project Details', `Project ${index + 1} of ${safeProjects.length}`)}
                        ${this.buildProjectDetailsCard(project)}
                        <div class="components-under-project">
                            <div class="nested-section-label">Component Details</div>
                            ${projectComponents.length > 0
                                ? this.generateComponentsHTML(projectComponents)
                                : '<div class="empty-state">No components recorded for this project.</div>'}
                        </div>
                    </section>
                `;
            })
            .join('');

        const unassignedHtml =
            unassignedComponents.length > 0
                ? `
                    <section class="project-section">
                        <div class="nested-section-label">Unassigned Components</div>
                        ${this.generateComponentsHTML(unassignedComponents)}
                    </section>
                `
                : '';

        const headerHtml = showProjectsSectionTitle
            ? '<h2 class="section-title" style="margin-top: 8px;">Projects &amp; Components</h2>'
            : '';

        return `${headerHtml}${projectsHtml}${unassignedHtml}`;
    }

    private generateProjectsHTML(projects: any[]): string {
        if (!projects || projects.length === 0) {
            return '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center; color: #64748b;">No property projects found.</div>';
        }

        return `
            <div style="margin-bottom: 40px;">
                ${projects.map(project => `
                    <div class="component-card" style="margin-bottom: 20px;">
                        <div class="component-head">
                            <h3>${project.project_type || 'Unnamed Project'}</h3>
                            <span class="status-badge ${project.project_status === 'COMPLETE' ? 'status-verified' : 'status-unverified'}">
                                ${project.project_status || 'DRAFT'}
                            </span>
                        </div>
                        <div class="component-body">
                            <div class="field-grid">
                                <div class="info-group">
                                    <span class="info-label">Project Type</span>
                                    <span class="info-value">${project.project_type || 'N/A'}</span>
                                </div>
                                <div class="info-group">
                                    <span class="info-label">Date of Install</span>
                                    <span class="info-value">${project.date_of_install ? new Date(project.date_of_install).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div class="info-group">
                                    <span class="info-label">Permit</span>
                                    <span class="info-value">${project.permit || 'N/A'}</span>
                                </div>
                                <div class="info-group">
                                    <span class="info-label">Contractor</span>
                                    <span class="info-value">${project.contractor?.first_name && project.contractor?.last_name ? project.contractor.first_name + ' ' + project.contractor.last_name : 'N/A'}</span>
                                </div>
                                <div class="info-group">
                                    <span class="info-label">Created By</span>
                                    <span class="info-value">${project.createdBy?.first_name && project.createdBy?.last_name ? project.createdBy.first_name + ' ' + project.createdBy.last_name : 'N/A'}</span>
                                </div>
                            </div>
                            ${project.notes ? `
                                <div class="info-group" style="margin-top: 20px;">
                                    <span class="info-label">Project Notes</span>
                                    <span class="info-value" style="font-weight: 400; font-size: 13px;">${project.notes}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private buildComponentTypeSpecificFields(component: any): string {
        const type = component.component_type;

        if (type === 'ROOFING' || type === 'SIDING') {
            return `
                <div class="info-group"><span class="info-label">Type</span><span class="info-value">${this.escapeHtml(component.type || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Style</span><span class="info-value">${this.escapeHtml(component.style || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Material</span><span class="info-value">${this.escapeHtml(component.material || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Color</span><span class="info-value">${this.escapeHtml(component.color || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Class Rating</span><span class="info-value">${this.escapeHtml(component.class_rating || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Impact Resistant</span><span class="info-value">${component.impact_resistant ? 'Yes' : 'No'}</span></div>
                ${type === 'SIDING' && component.elevation_data ? `
                <div class="info-group" style="grid-column: span 3;">
                    <span class="info-label">Elevation Data</span>
                    <span class="info-value" style="font-weight: 400; font-size: 12px;">${this.escapeHtml(typeof component.elevation_data === 'object' ? JSON.stringify(component.elevation_data) : component.elevation_data)}</span>
                </div>` : ''}
            `;
        }

        if (type === 'WINDOWS' || type === 'DOORS' || type === 'WINDOW_DOOR') {
            return `
                <div class="info-group"><span class="info-label">Production Line</span><span class="info-value">${this.escapeHtml(component.production_line || 'N/A')}</span></div>
                <div class="info-group"><span class="info-label">Order Number</span><span class="info-value">${this.escapeHtml(component.order_number || 'N/A')}</span></div>
                ${type === 'WINDOWS' && component.u_factor != null ? `
                <div class="info-group"><span class="info-label">U-Factor</span><span class="info-value">${this.escapeHtml(component.u_factor)}</span></div>` : ''}
            `;
        }

        if (type === 'GARAGE_DOORS') {
            return `
                <div class="info-group"><span class="info-label">Wind Code</span><span class="info-value">${this.escapeHtml(component.windcode || 'N/A')}</span></div>
            `;
        }

        return '';
    }

    private generateComponentsHTML(components: any[]): string {
        if (!components || components.length === 0) {
            return '<div class="empty-state">No components data available for this report.</div>';
        }

        return components
            .map(
                (component) => `
            <div class="component-card">
                <div class="component-head">
                    <h3>${this.escapeHtml(component.component_type || 'Component')}</h3>
                </div>
                <div class="component-body">
                    <div class="field-grid">
                        <div class="info-group">
                            <span class="info-label">Brand</span>
                            <span class="info-value">${this.escapeHtml(component.brand || component.other_brand || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Installer</span>
                            <span class="info-value">${this.escapeHtml(component.installer || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Supplier</span>
                            <span class="info-value">${this.escapeHtml(component.supplier || 'N/A')}</span>
                        </div>
                        <div class="info-group">
                            <span class="info-label">Install Date</span>
                            <span class="info-value">${component.install_date ? this.escapeHtml(new Date(component.install_date).toLocaleDateString()) : 'N/A'}</span>
                        </div>
                        ${this.buildComponentTypeSpecificFields(component)}
                        <div class="info-group">
                            <span class="info-label">Version</span>
                            <span class="info-value">${this.escapeHtml(component.version ?? 1)}</span>
                        </div>
                    </div>

                    <div class="info-group" style="margin-top: 8px;">
                        <span class="info-label">Description</span>
                        <span class="info-value" style="font-weight: 400; font-size: 13px;">${this.escapeHtml(component.description || 'No description provided.')}</span>
                    </div>

                    ${component.images && component.images.length > 0 ? `
                        <h3 class="section-title" style="margin-top: 22px;">Photographic Evidence</h3>
                        ${((imgs: any[]) => {
                            const contractorImages = imgs.filter((img) => img.image_url);
                            if (contractorImages.length === 0) return '';
                            return `
                                <div class="photo-section-label">Contractor Photos</div>
                                <div class="image-grid">
                                    ${contractorImages
                                        .map(
                                            (image: any, idx: number) => `
                                        <div class="image-item">
                                            <img src="${this.escapeHtml(image.image_url || '')}" alt="Contractor Image" />
                                            <p class="image-tag">${this.escapeHtml(image.image_category || `${component.component_type} ${idx + 1}`)}</p>
                                        </div>
                                    `,
                                        )
                                        .join('')}
                                </div>
                            `;
                        })(component.images)}
                        ${((imgs: any[]) => {
                            const ownerImages = imgs.filter((img) => img.property_owner_files);
                            if (ownerImages.length === 0) return '';
                            return `
                                <div class="photo-section-label">Property Owner Photos</div>
                                <div class="image-grid">
                                    ${ownerImages
                                        .map(
                                            (image: any, idx: number) => `
                                        <div class="image-item">
                                            <img src="${this.escapeHtml(image.property_owner_files || '')}" alt="Owner Image" />
                                            <p class="image-tag">${this.escapeHtml(image.image_category || `Owner ${idx + 1}`)}</p>
                                        </div>
                                    `,
                                        )
                                        .join('')}
                                </div>
                            `;
                        })(component.images)}
                    ` : ''}
                </div>
            </div>
        `,
            )
            .join('');
    }
}
