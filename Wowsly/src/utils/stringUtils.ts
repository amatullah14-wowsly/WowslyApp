/**
 * Converts a number to its English word representation.
 * Supports numbers up to safe integer limits.
 * @param num The number to convert
 * @returns The string representation in words
 */
export const numberToWords = (num: number | string): string => {
    const n = parseInt(num.toString(), 10);
    if (isNaN(n)) return '';
    if (n === 0) return 'Zero';

    const belowTwenty = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
        'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];
    const thousands = ['', 'Thousand', 'Million', 'Billion'];

    const helper = (n: number): string => {
        if (n === 0) return '';
        else if (n < 20) return belowTwenty[n] + ' ';
        else if (n < 100) return tens[Math.floor(n / 10)] + ' ' + helper(n % 10);
        else return belowTwenty[Math.floor(n / 100)] + ' Hundred ' + helper(n % 100);
    };

    let word = '';
    let i = 0;

    let tempN = n;

    while (tempN > 0) {
        if (tempN % 1000 !== 0) {
            word = helper(tempN % 1000) + thousands[i] + ' ' + word;
        }
        tempN = Math.floor(tempN / 1000);
        i++;
    }

    return word.trim();
};
