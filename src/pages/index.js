import React from "react"
import Layout from "../components/layout"
import Head from "../components/head"
import ColourBlock from "../components/colourblock"
import IconBar from "../components/iconbar"

import indexStyles from "./index.module.scss"

export default function Home() {
  return (
    <div>
      <Layout>
        <Head title="Home"/>
        <div className={indexStyles.headers}>
          <h1 className={indexStyles.name1}>faizaan sakib</h1>
          <h1 className={indexStyles.name2}>faizaan sakib</h1>
          <h1 className={indexStyles.name3}>faizaan sakib</h1>
          <h1 className={indexStyles.name4}>faizaan sakib</h1>
          <h1 className={indexStyles.jobTitle}>software engineer</h1>
          <ColourBlock></ColourBlock>
          <IconBar></IconBar>
        </div>
      </Layout>
    </div>
  )
}
