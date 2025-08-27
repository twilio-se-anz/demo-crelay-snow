import { Flex } from "@twilio/flex-ui/src/FlexGlobal";
import { ThemerParameters } from "./ThemerParameters";

export class Themer{
  static generateTheme(params: ThemerParameters) {
    
    const { lightText, darkText, background, themeName } = params;

    const newThemeConfig = {
      colorTheme: {
        baseName: themeName || "FlexLight",
        colors: {
          lightText: lightText,
          darkText: darkText,
        },
        overrides: {
          MainHeader: {
            Container: {
              color: lightText,
              background: background,
            },
            Button: {
              color: lightText,
              background: background,
            }
          },
        
          SideNav: {
            Container: {
              background: darkText,
            },
            Button: {
              background: darkText,
              color: lightText
            },
            Icon: {
              color: lightText
            }
          },

          TaskCanvasHeader: {
            WrapupTaskButton: {
              background: background,
              color: lightText,
            },
            EndTaskButton: {
              background: darkText,
              color: lightText,
            }
          },
          TaskList: {
            Item: {
              Icon: {
                background: background,
                color: lightText,
              }
            }
          }
        }
      }
    };
    
    return newThemeConfig as Flex.Config;
  }
}