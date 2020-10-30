import React from "react";
import BioGridBox from "../templates/biogridbox"

import bioGridStyles from "./biogrid.module.scss"

// reference: https://www.youtube.com/watch?v=icnZSJbNsEM

export default function BioGrid() {
    return (
      <div className={bioGridStyles.container}>
          <BioGridBox image='💼' header='current employment' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></BioGridBox>
          <BioGridBox image='⌨️' header='favourite language' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></BioGridBox>
          <BioGridBox image='🛠' header='favourite framework' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></BioGridBox>
          <BioGridBox image='😇' header='most proud of' text="I'm currently looking for opportunities in software engineering" alt=''></BioGridBox>
          <BioGridBox image='🧐' header='interested in' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></BioGridBox>
          <BioGridBox image='👨‍💻' header='currently working on' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></BioGridBox>
          <BioGridBox image='📚' header='currently learning ' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></BioGridBox>
          <BioGridBox image='💖' header='hobbies' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></BioGridBox>
      </div>
    );
  }
  