import React from "react"
import Layout from "../components/layout"
import Head from "../components/head"
import ColourBlock from "../components/colourblock"

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
          <ul className={indexStyles.iconBar}>
            <li>
              <a href="https://www.github.com/fznsakib" target="_blank" rel="noopener noreferrer" className={indexStyles.iconBarItem}>resume</a>
            </li>
            <li>
              <a href="mailto:fznsakib@gmail.com" target="_blank" rel="noopener noreferrer" className={indexStyles.iconBarItem}>email</a>
            </li>
            <li>
              <a href="https://www.linkedin.com/in/faizaan-sakib" target="_blank" rel="noopener noreferrer" className={indexStyles.iconBarItem}>linkedin</a>
            </li>
            <li>
              <a href="https://www.github.com/fznsakib" target="_blank" rel="noopener noreferrer" className={indexStyles.iconBarItem}>github</a>
            </li>
            <li>
              <a href="https://soundcloud.com/etaki" target="_blank" rel="noopener noreferrer" className={indexStyles.iconBarItem}>soundcloud</a>
            </li>
          </ul>
        </div>
      </Layout>
    </div>
  )
}
