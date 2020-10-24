import React from "react";
import GridBox from "../templates/gridbox.js"

import gridStyles from "./grid.module.scss"

export default function Grid() {
    return (
      <div className={gridStyles.container}>
          <GridBox image='💼' header='current employment' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='⌨️' header='favourite language' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='🛠' header='favourite framework' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='😇' header='most proud of' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='🧐' header='interested in' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='👨‍💻' header='currently working on' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='📚' header='currently learning ' text='This is a very long text blah blah blah' alt=''></GridBox>
          <GridBox image='💖' header='hobbies' text='This is a very long text blah blah blah' alt=''></GridBox>
      </div>
    );
  }
  