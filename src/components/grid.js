import React from "react";
import GridBox from "../templates/gridbox.js"

import gridStyles from "./grid.module.scss"

// reference: https://www.youtube.com/watch?v=icnZSJbNsEM

export default function Grid() {
    return (
      <div className={gridStyles.container}>
          <GridBox image='💼' header='current employment' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></GridBox>
          <GridBox image='⌨️' header='favourite language' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></GridBox>
          <GridBox image='🛠' header='favourite framework' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></GridBox>
          <GridBox image='😇' header='most proud of' text="I'm currently looking for opportunities in software engineering" alt=''></GridBox>
          <GridBox image='🧐' header='interested in' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></GridBox>
          <GridBox image='👨‍💻' header='currently working on' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></GridBox>
          <GridBox image='📚' header='currently learning ' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></GridBox>
          <GridBox image='💖' header='hobbies' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></GridBox>
      </div>
    );
  }
  