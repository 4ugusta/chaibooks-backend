// Convert number to words for Indian currency
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

function convertTwoDigit(n) {
  if (n < 10) return ones[n];
  if (n >= 10 && n < 20) return teens[n - 10];
  return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
}

function convertThreeDigit(n) {
  if (n === 0) return '';
  if (n < 100) return convertTwoDigit(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertTwoDigit(n % 100) : '');
}

function numberToWords(number) {
  if (number === 0) return 'Zero Rupees Only';

  const rupees = Math.floor(number);
  const paise = Math.round((number - rupees) * 100);

  let result = '';

  // Crores
  const crores = Math.floor(rupees / 10000000);
  if (crores > 0) {
    result += convertThreeDigit(crores) + ' Crore ';
  }

  // Lakhs
  const lakhs = Math.floor((rupees % 10000000) / 100000);
  if (lakhs > 0) {
    result += convertTwoDigit(lakhs) + ' Lakh ';
  }

  // Thousands
  const thousands = Math.floor((rupees % 100000) / 1000);
  if (thousands > 0) {
    result += convertTwoDigit(thousands) + ' Thousand ';
  }

  // Hundreds
  const remaining = rupees % 1000;
  if (remaining > 0) {
    result += convertThreeDigit(remaining) + ' ';
  }

  result += 'Rupees';

  // Paise
  if (paise > 0) {
    result += ' and ' + convertTwoDigit(paise) + ' Paise';
  }

  result += ' Only';

  return result.trim();
}

module.exports = { numberToWords };
