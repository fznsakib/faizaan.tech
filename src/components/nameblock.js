import React, { Component } from "react";
import nameBlockStyles from "./nameblock.module.scss";

class NameBlock extends Component {
  constructor(props) {
    super();
    this.state = {
      animate: true,
    };
  }

  render() {
    return (
      <div>
      <span className={nameBlockStyles.circle}></span>
      <div className={nameBlockStyles.nameHeaders}>
        <h1
          className={
            this.state.animate
              ? `${nameBlockStyles.name1Animation}`
              : `${nameBlockStyles.name1}`
          }
        >
          faizaan sakib
        </h1>
        <h1
          className={
            this.state.animate
              ? `${nameBlockStyles.name2Animation}`
              : `${nameBlockStyles.name2}`
          }
        >
          faizaan sakib
        </h1>
        <h1
          className={
            this.state.animate
              ? `${nameBlockStyles.name3Animation}`
              : `${nameBlockStyles.name3}`
          }
        >
          faizaan sakib
        </h1>
        <h1
          className={
            this.state.animate
              ? `${nameBlockStyles.name4Animation}`
              : `${nameBlockStyles.name4}`
          }
        >
          faizaan sakib
        </h1>
      </div>
      <div className={nameBlockStyles.jobHeader}>
        <h1
          className={
            this.state.animate
              ? `${nameBlockStyles.jobTitleAnimation}`
              : `${nameBlockStyles.jobTitle}`
          }
        >
          software engineer
        </h1>
      </div>
      </div>

    );
  }

  componentDidMount() {
    // Check for token
    if (window.sessionStorage.getItem("nameBlockLoaded") === null) {
      this.setState({
        animate: true,
      });
      // Set token so that animation is not performed next time
      window.sessionStorage.setItem("nameBlockLoaded", 1);
    } else {
      this.setState({
        animate: false,
      });
    }
  }
}

export default NameBlock;
