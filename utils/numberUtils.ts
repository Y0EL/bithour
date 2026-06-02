export function terbilang(n: number): string {
    if (isNaN(n)) return '';
    const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    let hasil = '';

    if (n < 12) {
        hasil = satuan[n];
    } else if (n < 20) {
        hasil = terbilang(n - 10) + ' Belas';
    } else if (n < 100) {
        hasil = terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10);
    } else if (n < 200) {
        hasil = 'Seratus ' + terbilang(n - 100);
    } else if (n < 1000) {
        hasil = terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100);
    } else if (n < 2000) {
        hasil = 'Seribu ' + terbilang(n - 1000);
    } else if (n < 1000000) {
        hasil = terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000);
    } else if (n < 1000000000) {
        hasil = terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000);
    } else if (n < 1000000000000) {
        hasil = terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000);
    }

    return hasil.trim().replace(/\s+/g, ' ');
}

export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

export function normalizeBankName(name: string): string {
    if (!name) return '';
    const n = name.toUpperCase();
    if (n.includes('CENTRAL ASIA') || n.includes('BCA')) return 'BCA';
    if (n.includes('NEGARA INDONESIA') || n.includes('BNI')) return 'BNI';
    if (n.includes('RAKYAT INDONESIA') || n.includes('BRI')) return 'BRI';
    if (n.includes('MANDIRI')) return 'Mandiri';
    if (n.includes('SYARIAH INDONESIA') || n.includes('BSI')) return 'BSI';
    if (n.includes('TABUNGAN NEGARA') || n.includes('BTN')) return 'BTN';
    return name;
}
