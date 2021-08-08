// 获取源文本
const fs = require('fs');
const rowString = fs.readFileSync('./d0_after_free.rpy').toString();

// 处理文本，按行拆分，过滤空行，去除首空
const rowText = rowString.split('\r\n').filter(line => line);
const text = rowText.map(line => line.trim());

// 判断每行文本的类型
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
  if(type === '2原文') {
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

// 循环步骤，生成结果
let step = null;
const contentList = [];
parseResult.forEach(result => {
  const nextStep = Number(result.type[0]);
  // 新的一句
  if(nextStep == 0) {
    step = 0;
    return;
  }
  // 递进到下一句
  if(nextStep == step + 1){
    step += 1;
    if(step == 2) {
      contentList.push(result);
    }
    return;
  }
  // 没有成功递进到下一句，等待0开始下一句
  step = null;
  return;
});

// 提取有效句子，放入文本框
const translateText = contentList.map(content => content.textContent).join('\r\n');
fs.writeFileSync('./output.txt', translateText);

// 将翻译结果还原为代码