import React, { useRef, useState } from "react";
import { Flex, Label, Button, Box } from "theme-ui";
import { useToasts } from "react-toast-notifications";
import ReactResizeDetector from "react-resize-detector";

import EditTokenModal from "./EditTokenModal";
import ConfirmModal from "./ConfirmModal";

import Modal from "../components/Modal";
import ImageDrop from "../components/ImageDrop";
import LoadingOverlay from "../components/LoadingOverlay";

import TokenTiles from "../components/token/TokenTiles";

import TilesOverlay from "../components/tile/TilesOverlay";
import TilesContainer from "../components/tile/TilesContainer";
import TilesAddDroppable from "../components/tile/TilesAddDroppable";

import {
  groupsFromIds,
  itemsFromGroups,
  getGroupItems,
} from "../helpers/group";
import {
  createTokenFromFile,
  createTokenState,
  clientPositionToMapPosition,
} from "../helpers/token";
import Vector2 from "../helpers/Vector2";

import useResponsiveLayout from "../hooks/useResponsiveLayout";

import { useTokenData } from "../contexts/TokenDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useKeyboard } from "../contexts/KeyboardContext";
import { useAssets } from "../contexts/AssetsContext";
import { GroupProvider } from "../contexts/GroupContext";
import { TileDragProvider } from "../contexts/TileDragContext";
import { useMapStage } from "../contexts/MapStageContext";

import shortcuts from "../shortcuts";

function SelectTokensModal({ isOpen, onRequestClose, onMapTokenStateCreate }) {
  const { addToast } = useToasts();

  const { userId } = useAuth();
  const {
    tokens,
    addToken,
    removeTokens,
    // updateTokens,
    tokensLoading,
    tokenGroups,
    updateTokenGroups,
    updateToken,
    tokensById,
  } = useTokenData();
  const { addAssets } = useAssets();

  /**
   * Image Upload
   */

  const fileInputRef = useRef();
  const [isLoading, setIsLoading] = useState(false);

  const [isLargeImageWarningModalOpen, setShowLargeImageWarning] = useState(
    false
  );
  const largeImageWarningFiles = useRef();

  async function handleImagesUpload(files) {
    if (navigator.storage) {
      // Attempt to enable persistant storage
      await navigator.storage.persist();
    }

    let tokenFiles = [];
    for (let file of files) {
      if (file.size > 5e7) {
        addToast(`Unable to import token ${file.name} as it is over 50MB`);
      } else {
        tokenFiles.push(file);
      }
    }

    // Any file greater than 20MB
    if (tokenFiles.some((file) => file.size > 2e7)) {
      largeImageWarningFiles.current = tokenFiles;
      setShowLargeImageWarning(true);
      return;
    }

    for (let file of tokenFiles) {
      await handleImageUpload(file);
    }

    clearFileInput();
  }

  function clearFileInput() {
    // Set file input to null to allow adding the same image 2 times in a row
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  }

  function handleLargeImageWarningCancel() {
    largeImageWarningFiles.current = undefined;
    setShowLargeImageWarning(false);
    clearFileInput();
  }

  async function handleLargeImageWarningConfirm() {
    setShowLargeImageWarning(false);
    const files = largeImageWarningFiles.current;
    for (let file of files) {
      await handleImageUpload(file);
    }
    largeImageWarningFiles.current = undefined;
    clearFileInput();
  }

  async function handleImageUpload(file) {
    setIsLoading(true);
    const { token, assets } = await createTokenFromFile(file, userId);
    await addToken(token);
    await addAssets(assets);
    setIsLoading(false);
  }

  /**
   * Token controls
   */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  function getSelectedTokens() {
    const groups = groupsFromIds(selectedGroupIds, tokenGroups);
    return itemsFromGroups(groups, tokens);
  }

  const [isTokensRemoveModalOpen, setIsTokensRemoveModalOpen] = useState(false);
  async function handleTokensRemove() {
    setIsLoading(true);
    setIsTokensRemoveModalOpen(false);
    const selectedTokens = getSelectedTokens();
    const selectedTokenIds = selectedTokens.map((token) => token.id);
    await removeTokens(selectedTokenIds);
    setSelectedGroupIds([]);
    setIsLoading(false);
  }

  // async function handleTokensHide(hideInSidebar) {
  //   setIsLoading(true);
  //   const selectedTokens = getSelectedTokens();
  //   const selectedTokenIds = selectedTokens.map((token) => token.id);
  //   await updateTokens(selectedTokenIds, { hideInSidebar });
  //   setIsLoading(false);
  // }

  const mapStageRef = useMapStage();
  function handleTokensAddToMap(groupIds, rect) {
    let clientPosition = new Vector2(
      rect.width / 2 + rect.offsetLeft,
      rect.height / 2 + rect.offsetTop
    );
    const mapStage = mapStageRef.current;
    if (!mapStage) {
      return;
    }

    let position = clientPositionToMapPosition(mapStage, clientPosition, false);
    if (!position) {
      return;
    }

    for (let id of groupIds) {
      if (id in tokensById) {
        onMapTokenStateCreate(
          createTokenState(tokensById[id], position, userId)
        );
        position = Vector2.add(position, 0.01);
      } else {
        // Check if a group is selected
        const group = tokenGroups.find(
          (group) => group.id === id && group.type === "group"
        );
        if (group) {
          // Add all tokens of group
          const items = getGroupItems(group);
          for (let item of items) {
            if (item.id in tokensById) {
              onMapTokenStateCreate(
                createTokenState(tokensById[item.id], position, userId)
              );
              position = Vector2.add(position, 0.01);
            }
          }
        }
      }
    }
  }

  /**
   * Shortcuts
   */
  function handleKeyDown(event) {
    if (!isOpen) {
      return;
    }
    if (shortcuts.delete(event)) {
      const selectedTokens = getSelectedTokens();
      // Selected tokens and none are default
      if (
        selectedTokens.length > 0 &&
        !selectedTokens.some((token) => token.type === "default")
      ) {
        // Ensure all other modals are closed
        setIsEditModalOpen(false);
        setIsTokensRemoveModalOpen(true);
      }
    }
  }

  useKeyboard(handleKeyDown);

  const layout = useResponsiveLayout();

  const [modalSize, setModalSize] = useState({ width: 0, height: 0 });
  function handleModalResize(width, height) {
    setModalSize({ width, height });
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{ maxWidth: layout.modalSize, width: "calc(100% - 16px)" }}
    >
      <ImageDrop onDrop={handleImagesUpload} dropText="Drop token to upload">
        <input
          onChange={(event) => handleImagesUpload(event.target.files)}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          ref={fileInputRef}
          multiple
        />
        <ReactResizeDetector
          handleWidth
          handleHeight
          onResize={handleModalResize}
        >
          <Flex
            sx={{
              flexDirection: "column",
            }}
          >
            <Label pt={2} pb={1}>
              Edit or import a token
            </Label>
            <Box sx={{ position: "relative" }}>
              <GroupProvider
                groups={tokenGroups}
                onGroupsChange={updateTokenGroups}
                onGroupsSelect={setSelectedGroupIds}
                disabled={!isOpen}
              >
                <TileDragProvider onDragAdd={handleTokensAddToMap}>
                  <TilesAddDroppable containerSize={modalSize} />
                  <TilesContainer>
                    <TokenTiles
                      tokens={tokens}
                      onTokenEdit={() => setIsEditModalOpen(true)}
                    />
                  </TilesContainer>
                </TileDragProvider>
                <TileDragProvider onDragAdd={handleTokensAddToMap}>
                  <TilesAddDroppable containerSize={modalSize} />
                  <TilesOverlay>
                    <TokenTiles
                      tokens={tokens}
                      onTokenEdit={() => setIsEditModalOpen(true)}
                      subgroup
                    />
                  </TilesOverlay>
                </TileDragProvider>
              </GroupProvider>
            </Box>

            <Button
              variant="primary"
              disabled={isLoading}
              onClick={onRequestClose}
              mt={2}
            >
              Done
            </Button>
          </Flex>
        </ReactResizeDetector>
      </ImageDrop>
      {(isLoading || tokensLoading) && <LoadingOverlay bg="overlay" />}
      <EditTokenModal
        isOpen={isEditModalOpen}
        onDone={() => setIsEditModalOpen(false)}
        token={
          selectedGroupIds.length === 1 &&
          tokens.find((token) => token.id === selectedGroupIds[0])
        }
        onTokenUpdate={updateToken}
      />
      <ConfirmModal
        isOpen={isTokensRemoveModalOpen}
        onRequestClose={() => setIsTokensRemoveModalOpen(false)}
        onConfirm={handleTokensRemove}
        confirmText="Remove"
        label="Remove Token(s)"
        description="This operation cannot be undone."
      />
      <ConfirmModal
        isOpen={isLargeImageWarningModalOpen}
        onRequestClose={handleLargeImageWarningCancel}
        onConfirm={handleLargeImageWarningConfirm}
        confirmText="Continue"
        label="Warning"
        description="An imported image is larger than 20MB, this may cause slowness. Continue?"
      />
    </Modal>
  );
}

export default SelectTokensModal;
