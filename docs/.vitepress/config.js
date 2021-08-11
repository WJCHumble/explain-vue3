module.exports = {
  title: "Vue3 源码解读",
  desciption: "带你深入浅出，瞻仰 Vue3 源码的魅力",
  base: process.env.NODE_ENV === "development" ? "/" : "/explain-vue3/",
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
          text: "准备工作",
          children: [
            {
              text: "Introduction",
              link: "/chapter1/"
            }
          ]
        },
        {
          text: "模板编译",
          children: [
            {
              text: "Introduction",
              link: "/chapter2/"
            },
            {
              text: "baseParse",
              link: "/chapter2/baseParse"
            },
            {
              text: "transform",
              link: "/chapter2/transform"
            },
            {
              text: "generate",
              link: "/chapter2/generate"
            }
          ]
        },
        {
          text: "组件创建过程",
          children: [
            {
              text: "Introduction",
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
              text: "Introduction",
              link: "/chapter4/"
            }
          ]
        },
        {
          text: "基于 Proxy 的响应式原理",
          children: [
            {
              text: "Introduction",
              link: "/chapter5/"
            },
            {
              text: "reactive",
              link: "/chapter5/reactive"
            },
            {
              text: "依赖收集",
              link: "/chapter5/depCollection"
            },
            {
              text: "派发更新",
              link: "/chapter5/notifyUpdate"
            },
          ]
        },
        {
          text: "内置组件",
          children: [
            {
              text: "Introduction",
              link: "/chapter6/"
            },
            {
              text: "teleport",
              link: "/chapter6/teleport"
            }
          ]
        },
        {
          text: "常用指令",
          children: [
            {
              text: "Introduction",
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
        },
        {
          text: "特性",
          children: [
            {
              text: "Introduction",
              link: "/chapter8/"
            },
            {
              text: "style css variable injection",
              link: "/chapter8/styleCssVars"
            }
          ]
        }
      ]
    }
  },
};