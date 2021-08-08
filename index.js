// 获取源文本
const fs = require('fs');
const rowText = fs.readFileSync('./d0_after_free.rpy').toString().split('\r\n').filter(line => line);

// 按行拆分，过滤空行，去除首空
const text = rowText.map(line => line.trim());

const typeTestList = [
  {
    type: '0原文位置',
    regex: /^# game\/(.*).rpy:(\d*)$/,
  },
  {
    type: '1翻译标记',
    regex: /^translate (\w*) (\w*):$/,
  },
  {
    type: '2原文',
    regex: /^# (\w* )?"(.*)"$/,
  },
  {
    type: '3旧翻译',
    regex: /^(.* )?"(.*)"$/,
  },
];
function judgeType(line) {
  for(const typeTest of typeTestList) {
    if(typeTest.regex.test(line)) {
      return typeTest.type;
    }
  }
  return '未知';
}
const parseResult = text.map((line, index) => {
  const type = judgeType(line);
  if(type === '原文') {
    const start = line.indexOf('"');
    const trueText = line.slice(start + 1, line.length - 1);
    return {
      type,
      source: rowText[index],
      text: line,
      textPrefix: line.slice(0, start),
      textContent: trueText,
    };
  }
  return {
    type,
    source: rowText[index],
    text: line,
  };
});
console.log(parseResult);