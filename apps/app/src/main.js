/**
 * Main application entry point
 */

import { createApp } from "vue"
import { createPinia } from "pinia"
import Antd from "ant-design-vue"

// Stylesheet order is load-bearing. Ant's reset sets `body { font-family }` at
// plain element specificity; if it loads last it silently overrides the design
// system's font with no error and no visible cause.
import "ant-design-vue/dist/reset.css"
import "@/assets/design-system/styles.css"
import "@/assets/app.css"

import App from "./App.vue"
import router from "./router"

const app = createApp(App)

// Setup plugins
app.use(createPinia())
app.use(router)
app.use(Antd)

// Mount application
app.mount("#app")
