import React, { Component } from "react";
import colourBlockStyles from "./colourblock.module.scss";

class ColourBlock extends Component {
  constructor(props) {
    super();
    this.state = {
      animate: true,
    };
  }

  render() {
    return (
      <div className={colourBlockStyles.colourBlock}>
        <div
          className={
            this.state.animate
              ? `${colourBlockStyles.rectangle1Animation}`
              : `${colourBlockStyles.rectangle1}`
          }
        ></div>
        <div
          className={
            this.state.animate
              ? `${colourBlockStyles.rectangle2Animation}`
              : `${colourBlockStyles.rectangle2}`
          }
        ></div>
        <div
          className={
            this.state.animate
              ? `${colourBlockStyles.rectangle3Animation}`
              : `${colourBlockStyles.rectangle3}`
          }
        ></div>
        <div
          className={
            this.state.animate
              ? `${colourBlockStyles.rectangle4Animation}`
              : `${colourBlockStyles.rectangle4}`
          }
        ></div>
      </div>
    );
  }

  componentDidMount() {
    // Check for token
    if (window.sessionStorage.getItem("colourBlockLoaded") === null) {
      this.setState({
        animate: true,
      });
      // Set token so that animation is not performed next time
      window.sessionStorage.setItem("colourBlockLoaded", 1);
    } else {
      this.setState({
        animate: false,
      });
    }
  }
}

export default ColourBlock;
