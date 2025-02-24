import { StyleSheet, Button, NativeModules, View, Text } from "react-native";
import { useNavigation } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, {
  RefObject,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";
import PSPDFKitView, { PDFConfiguration } from "react-native-pspdfkit";
import { useAssets } from "expo-asset";
import { Snackbar } from "react-native-paper";
import { documentDirectory } from "expo-file-system";
NativeModules.PSPDFKit.setLicenseKeys(null, null);

export default function HomeScreen() {
  const [assets, _error] = useAssets([
    require("../../assets/requiredFields.pdf"),
  ]);

  if (!assets || !assets.length) return null;

  return <PDFEditor pdfUrl={assets[0].uri} />;
}

export type PDFAnnotation = {
  isRequired: boolean;
  formFieldName: string;
  pageIndex: number;
  rotation?: number;
  type: "string";
  opacity: number;
  creatorName: string;
  bbox: [number, number, number, number];
  uuid: string;
};

type PDFEditorSaveResultUnknownError = { type: "unknown"; error: boolean };
type PDFEditorSaveResultSuccess = {
  type: "success";
  data: string;
  error: boolean;
};
type PDFEditorSaveResultErrorRequiredField = {
  type: "requiredFieldError";
  message: string;
  data: PDFAnnotation;
  error: boolean;
};

export type PDFEditorSaveResult =
  | PDFEditorSaveResultSuccess
  | PDFEditorSaveResultErrorRequiredField
  | PDFEditorSaveResultUnknownError;

type PSPDFKitAnnotation = {
  v: number;
  createdAt: string;
  creatorName: string;
  pageIndex: number;
  type: string;
  note: string;
  bbox: [number, number, number, number];
  formFieldName?: string;
  isRequired: boolean;
};

export type PDFEditorProps = {
  pdfUrl: string;
  onSaved?: (outPut: string) => void;
};

export type PDFEditorRef = {
  save: (newPath: string) => Promise<PDFEditorSaveResult>;
};

export const PDFEditor = forwardRef<PDFEditorRef, PDFEditorProps>(
  ({ pdfUrl, onSaved }, ref) => {
    const navigation = useNavigation();
    const pdfRef = useRef<PSPDFKitView | null>();
    const [error, setError] = useState<PDFEditorSaveResult>();
    const [pageIndex, setPageIndex] = useState(0);

    const snackbarStyle = [
      styles.snackbar,
      {
        backgroundColor: "gray",
      },
    ];


    const generateRandomNumber = () => {
      const min = 1;
      const max = 10000;
      return Math.floor(Math.random() * (max - min + 1)) + min;
  };

    useEffect(() => {
      const removeListener = navigation.addListener("beforeRemove", (_e) => {
        pdfRef.current?.destroyView();
      });

      return () => {
        removeListener();
      };
    }, [navigation, pdfRef]);

    useEffect(() => {
      (async () => {
        await ScreenOrientation.unlockAsync();
      })();

      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      };
    }, []);

    const save = async (newPath: string): Promise<PDFEditorSaveResult> => {
      if (newPath && pdfRef.current) {
        try {
          const document = pdfRef?.current?.getDocument();
          if (document) {
            const incompleteField = await findIncompleteRequiredField(
              pdfRef.current
            );
            if (incompleteField) {
              const theError: PDFEditorSaveResultErrorRequiredField = {
                error: true,
                message: "Please fill all required fields.",
                data: incompleteField,
                type: "requiredFieldError",
              };

              setPageIndex(incompleteField.pageIndex);
              console.log("page index of required field: ", incompleteField.pageIndex)
              setError(theError);

              console.log("SAVE ERROR: ", theError);
              return theError;
            }

            console.log("SAVE SUCCESS");
          }
        } catch (error) {
          console.log("Error processing pdf:", error);
          return { error: true, type: "unknown" };
        }
      }
      return { error: false, type: "success", data: newPath };
    };

    const findIncompleteRequiredField = async (
      pdfEditor: PSPDFKitView | undefined
    ): Promise<PDFAnnotation | undefined> => {
      if (!pdfEditor) return undefined;

      const pdfDocument = pdfEditor.getDocument();

      // All Annotations are required
      const allAnnotations: PDFAnnotation[] =
        await pdfDocument.getAnnotations();

      if (!allAnnotations.length) {
        console.log("No required annotations found");
        return undefined;
      }

      for (const annotation of allAnnotations) {
        const response = await pdfEditor.getFormFieldValue(
          annotation.formFieldName
        );

        // I've opened a PSPDFKit ticket for the following issue:  Ticket #121698
        if (
          /* @ts-expect-error the type definition is wrong */
          typeof response?.value === "undefined" ||
          /* @ts-expect-error the type definition is wrong */
          response.value === null ||
          /* @ts-expect-error the type definition is wrong */
          response.value.length === 0
        ) {
          console.log("Found an invalid annotation!", annotation);
          return annotation;
        }
      }

      return undefined;
    };

    return (
      <View style={{ flex: 1, paddingTop: 50 }}>
        <Snackbar
          wrapperStyle={snackbarStyle}
          visible={typeof error !== "undefined"}
          onDismiss={() => setError(undefined)}
        >
          <View style={styles.snackbarContentWrapper}>
            <Text>Error: required field not filled!</Text>
          </View>
        </Snackbar>

        <PSPDFKitView
          document={pdfUrl}
          hideNavigationBar={false}
          hideDefaultToolbar={false}
          onNavigationButtonClicked={() => {
            navigation.goBack();
          }}
          onStateChanged={(event: any) => {
            // When setting page index on state change in android, we get expected behavior
          //  setPageIndex(event.currentPageIndex);
          }}
          pageIndex={pageIndex}
          showNavigationButtonInToolbar={false}
          configuration={{
            androidShowSettingsMenu: false,
            androidShowShareAction: false,
            iOSShouldAskForAnnotationUsername: false,
            showThumbnailBar: PDFConfiguration.ShowThumbnailBar.SCROLLABLE,
            pageTransition: PDFConfiguration.PageTransition.SCROLL_CONTINUOUS,
            scrollDirection: PDFConfiguration.ScrollDirection.VERTICAL,
            signatureSavingStrategy:
              PDFConfiguration.SignatureSavingStrategy.NEVER_SAVE,
          }}
          ref={pdfRef as RefObject<PSPDFKitView>}
          style={[styles.container]}
        />
        <Button
          title="SAVE"
          onPress={() => {
            const random = generateRandomNumber()
            const documentName = `${random}.pdf`;
            const documentPath = documentDirectory + documentName;
            save(documentPath);
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  snackbarContentWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  snackbar: {
    zIndex: 100,
  },
});
