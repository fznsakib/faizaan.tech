import { useStaticQuery, graphql } from "gatsby";

export default function ProfilePicture() {
  const data = useStaticQuery(graphql`
    query {
      file(relativePath: { eq: "images/profile_picture.jpg" }) {
        childImageSharp {
          fixed(height: 280) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);

  return data.file.childImageSharp.fixed;
}
