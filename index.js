const isDev = false;

// 初始化节点
let area1 = null;
let area2 = null;
let area3 = null;
let area4 = null;
if(isDev) {
  const parent = document.querySelector('.lmt__text');
  const trueArea = document.querySelector('.lmt__sides_container');
  const root = document.createElement('div');
  root.className = 'lmt__sides_container';
  root.innerHTML = `
    <div class="lmt__side_container lmt__side_container--source">
      <div class="lmt__textarea_container" style="padding: 10px">
        <div style="padding-bottom: 10px">输入源码</div>
        <div class="lmt__inner_textarea_container">
          <textarea class="lmt__textarea lmt__source_textarea lmt__textarea_base_style"
            style="font-size: 14px;overflow-y: scroll;"></textarea>
        </div>
      </div>
    </div>
    <div class="lmt__side_container lmt__side_container--target">
      <div class="lmt__textarea_container" style="padding: 20px">
      <div style="padding-bottom: 10px">翻译后转换的源码</div>
        <div class="lmt__inner_textarea_container">
          <textarea class="lmt__textarea lmt__source_textarea lmt__textarea_base_style"
            style="font-size: 14px;overflow-y: scroll;"></textarea>
        </div>
      </div>
    </div>
  `;
  parent.insertBefore(root, trueArea);
  [area1, area2, area3, area4] = document.querySelectorAll('textarea');
  area1.addEventListener('input', (e) => {
    const value = e.target.value;
    area3.value = value;
    const fakeEvent = document.createEvent('HTMLEvents');
    fakeEvent.initEvent('input');
    area3.dispatchEvent(fakeEvent);
  });
}

// 获取源文本
let fs = isDev ? require('fs') : null;
if(isDev) {
  const rowString = fs.readFileSync('./d0_after_free.rpy').toString();
} else {
  
}

// 解析代码，提取内容
const { parseResult, contentList } = rpy2content(rowString);
const translateRowText = contentList.map(content => content.textContent).join('\n');

// 将有效文本放入文本框
if(isDev) {
  fs.writeFileSync('./content.txt', translateRowText);
} else {
  area3.value = translateRowText;
}

/* 手动点击翻译按钮 */

// 从文本框中读取翻译结果
const translateString = fs.readFileSync('./translate.txt').toString();
const finalString = translate2code(translateString, contentList, parseResult);
fs.writeFileSync('final.rpy', finalString.join('\n'));

// 解析rpy脚本，得出解析结果和内容
function rpy2content (rowString) {
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
  // 解析原文
  const parseResult = text.map((line, index) => {
    const type = judgeType(line);
    if(type === '2原文') {
      const start = line.indexOf('"');
      const trueText = line.slice(start + 1, line.length - 1);
      return {
        type,
        source: rowText[index],
        text: line,
        textPrefix: line.slice(2, start),
        textContent: trueText,
        translate: '',
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
  return {
    parseResult,
    contentList,
  }
}

// 将翻译结果还原为代码
function translate2code (translateString, contentList, parseResult) {
  const translate = translateString.replace(/\r/g, '').split('\n')
  if(translate.length !== contentList.length) return console.error('错误：翻译后的行数与翻译前不同，请联系林彼丢排查错误！');
  contentList.forEach((content, index) => {
    content.translate = translate[index];
  });
  let lastIsSource = false;
  const finalString = parseResult.map(({ type, source, translate, textPrefix }, index) => {
    if(type === '2原文') {
      lastIsSource = true;
      return `\n${source}\n    ${textPrefix}"${translate}"\n`;
    }
    // 如果上一句原文已经有新翻译了，就不使用旧翻译
    if(type === '3旧翻译' && lastIsSource) {
      lastIsSource = false;
      return;
    }
    lastIsSource = false;
    return source;
  }).filter(line => line);
  return finalString;
}
