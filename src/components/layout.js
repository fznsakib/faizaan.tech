import React from "react"
import Navbar from "./navbar"

import '../styles/index.scss'
import layoutStyles from './layout.module.scss'

export default function Layout(props) {
  return (
    <div>
      <div className={layoutStyles.container}>
        <div className={layoutStyles.content}>
          {props.children}
        </div>
        <Navbar/>
      </div>
    </div>
  )
}