/**
 * Main application entry point
 */

import { createApp } from "vue"
import { createPinia } from "pinia"
import Antd from "ant-design-vue"
import "ant-design-vue/dist/reset.css"

import App from "./App.vue"
import router from "./router"

const app = createApp(App)

// Setup plugins
app.use(createPinia())
app.use(router)
app.use(Antd)

// Mount application
app.mount("#app")
