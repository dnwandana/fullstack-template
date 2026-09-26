/**
 * Main application entry point
 */

import { createApp } from "vue"
import { createPinia } from "pinia"

import "@/assets/tailwind.css"

import App from "./App.vue"
import router from "./router"

const app = createApp(App)

// Setup plugins
app.use(createPinia())
app.use(router)

// Mount application
app.mount("#app")
