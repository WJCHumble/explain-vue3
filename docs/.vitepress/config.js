module.exports = {
  title: "Vue3.0 源码解读",
  desciption: "带你深入浅出，瞻仰 Vue3 源码的魅力",
  head: [
    [
      'style',
      {},
      'img { border-radius: 10px }' + 'h1.title { margin-left: 0.5em }'
    ]
  ],
  themeConfig: {
    editLinks: false,
    docsDir: "docs",
    nav: [
      { text: "GitHub", link: "https://github.com/WJCHumble/explain-vue3.0"}
    ],
    sidebar: {
      '/': [
        {
          text: "项目结构设计",
          children: [
            {
              text: "基本介绍",
              link: "/chapter1/"
            }
          ]
        },
        {
          text: "模板编译",
          children: [
            {
              text: "基本介绍",
              link: "/chapter2/"
            },
            {
              text: "baseParse 解析生成 AST",
              link: "/chapter2/baseParse"
            },
            {
              text: "generate 生成可执行代码",
              link: "/chapter1/transform"
            }
            ,
            {
              text: "transform 优化 AST",
              link: "chapter2/generate"
            }
          ]
        },
        {
          text: "组件创建过程",
          children: [
            {
              text: "基本介绍",
              link: "/chapter3/"
            },
            {
              text: "setupComponent",
              link: "chapter3/setupComponent"
            },
            {
              text: "finishComponentSetup",
              link: "chapter3/finishComponentSetup"
            }
          ]
        },
        {
          text: "组件更新过程",
          children: [
            {
              text: "基本介绍",
              link: "/chapter4/"
            }
          ]
        },
        {
          text: "基于 Proxy 的响应式原理",
          children: [
            {
              text: "基本介绍",
              link: "/chapter5/"
            },
            {
              text: "reactive API",
              link: "/chapter5/reactive"
            },
            {
              text: "依赖收集（track）",
              link: "/chapter5/depCollection"
            },
            {
              text: "派发更新（trigger）",
              link: "/chapter5/notifyUpdate"
            },
          ]
        },
        {
          text: "内置组件",
          children: [
            {
              text: "基本介绍",
              link: "/chapter6/"
            },
            {
              text: "telport",
              link: "/chapter6/teleport"
            }
          ]
        },
        {
          text: "常用指令",
          children: [
            {
              text: "基本介绍",
              link: "/chapter7/"
            },
            {
              text: "v-if",
              link: "/chapter7/v-if"
            },
            {
              text: "v-show",
              link: "/chapter7/v-show"
            }
          ]
        }
      ]
    }
  },
};