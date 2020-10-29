import React from "react";
import InfoGridBox from "../templates/infogridbox"

import infoGridStyles from "./infogrid.module.scss"

// reference: https://www.youtube.com/watch?v=icnZSJbNsEM

export default function InfoGrid() {
    return (
      <div className={infoGridStyles.container}>
          <InfoGridBox image='💼' header='current employment' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></InfoGridBox>
          <InfoGridBox image='⌨️' header='favourite language' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></InfoGridBox>
          <InfoGridBox image='🛠' header='favourite framework' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></InfoGridBox>
          <InfoGridBox image='😇' header='most proud of' text="I'm currently looking for opportunities in software engineering" alt=''></InfoGridBox>
          <InfoGridBox image='🧐' header='interested in' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></InfoGridBox>
          <InfoGridBox image='👨‍💻' header='currently working on' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></InfoGridBox>
          <InfoGridBox image='📚' header='currently learning ' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies." alt=''></InfoGridBox>
          <InfoGridBox image='💖' header='hobbies' text="I'm currently looking for opportunities in software engineering, for which I'm open to roles in small to large sized companies.  I'm hoping my new role can give me the chance to put my current skills to use while continuing to grow my skillset, by learning from doing and from talented engineers around me. Reach out to me via the provided options on the home page!" alt=''></InfoGridBox>
      </div>
    );
  }
  