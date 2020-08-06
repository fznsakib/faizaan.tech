import React from "react"
import colourBlockStyles from "./colourblock.module.scss"

export default function ColourBlock(props) {
    return (
        <div className={colourBlockStyles.colourBlock}>
            <div className={colourBlockStyles.rectangle1}></div>
            <div className={colourBlockStyles.rectangle2}></div>
            <div className={colourBlockStyles.rectangle3}></div>
            <div className={colourBlockStyles.rectangle4}></div>
        </div>
        
    )
  }