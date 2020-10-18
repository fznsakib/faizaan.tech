import React, { Component } from "react";
import layoutStyles from "./layout.module.scss"
import introStyles from "./intro.module.scss";

class Intro extends Component {
  constructor(props) {
    super();
  }

  render() {
    return (
        <div className={layoutStyles.row}>
            <div className={layoutStyles.column}>
                <img className={introStyles.profilePicture} src={'/profile_picture.jpg'} alt="Faizaan"></img>
            </div>
            <div className={layoutStyles.column}>
                <div className={introStyles.greeting}>
                    <h1>Hey, I'm Faizaan!</h1>
                </div>
            </div>
        </div>
    );
  }
}

export default Intro;
