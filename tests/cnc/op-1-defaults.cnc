=   http://www.cimco-software.com/namespace/nc/format/compact-nci    
   ?   http://www.cimco-software.com/namespace/nc/parameter/product-id	   fusion360   A   http://www.cimco-software.com/namespace/nc/parameter/generated-by   F u s i o n   3 6 0   C A M   2 . 0 . 1 5 0 5 0    A   http://www.cimco-software.com/namespace/nc/parameter/generated-at%   S a t u r d a y ,   J a n u a r y   1 4 ,   2 0 2 3   6 : 0 0 : 3 5   P M    =   http://www.cimco-software.com/namespace/nc/parameter/hostname   D E S K T O P - 8 F U G 9 2 U    =   http://www.cimco-software.com/namespace/nc/parameter/username   c h r i s    B   http://www.cimco-software.com/namespace/nc/parameter/document-path   o p - 1 - d e f a u l t s   v 2    @   http://www.cimco-software.com/namespace/nc/parameter/document-id$   e 8 e 9 5 a 9 0 - 4 d e f - 4 3 d d - b 1 e a - 9 7 4 1 5 b 3 b 4 1 d 9    B   http://www.cimco-software.com/namespace/nc/parameter/model-version$   7 d f e 8 2 3 2 - c a 9 f - 4 f 1 c - 8 9 7 9 - a 8 8 2 3 4 2 a 6 9 8 f       ncprogram-id         leads-supported      D   http://www.cimco-software.com/namespace/nc/parameter/job-description   S e t u p 1    ?   http://www.cimco-software.com/namespace/nc/parameter/machine-id   1 
   
   machine-v2�  {
   "controller" : {
      "default" : {
         "max_block_processing_speed" : 0,
         "max_normal_speed" : 0,
         "parts" : {
            "linear_0" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "negative",
               "reset" : "never",
               "reversed" : false,
               "tcp" : false,
               "zero_position_offset" : 0
            },
            "linear_1" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "no preference",
               "reset" : "never",
               "reversed" : false,
               "tcp" : true,
               "zero_position_offset" : 0
            },
            "linear_2" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "no preference",
               "reset" : "never",
               "reversed" : false,
               "tcp" : true,
               "zero_position_offset" : 0
            }
         }
      }
   },
   "general" : {
      "capabilities" : [ "cutting" ],
      "description" : "Cutting post that generates .cnc intermediate files",
      "minimumRevision" : 45805,
      "model" : "CNC intermediate",
      "vendor" : "Autodesk"
   },
   "kinematics" : {
      "default" : {
         "conventions" : {
            "rotation" : "right-handed"
         },
         "parts" : [
            {
               "control" : "driven",
               "direction" : [ -1, 0, 0 ],
               "id" : "linear_0",
               "name" : "X",
               "parts" : [
                  {
                     "control" : "driven",
                     "direction" : [ 0, -1, 0 ],
                     "id" : "linear_1",
                     "name" : "Y",
                     "parts" : [
                        {
                           "control" : "driven",
                           "direction" : [ 0, 0, -1 ],
                           "id" : "linear_2",
                           "name" : "Z",
                           "parts" : [
                              {
                                 "attach_frame" : {
                                    "point" : [ 0, 0, 0 ],
                                    "x_direction" : [ 1, 0, 0 ],
                                    "z_direction" : [ 0, 0, 1 ]
                                 },
                                 "display_name" : "table",
                                 "id" : "table",
                                 "type" : "table"
                              }
                           ],
                           "type" : "linear"
                        }
                     ],
                     "type" : "linear"
                  }
               ],
               "type" : "linear"
            },
            {
               "attach_frame" : {
                  "point" : [ 0, 0, 0 ],
                  "x_direction" : [ 1, 0, 0 ],
                  "z_direction" : [ 0, 0, 1 ]
               },
               "display_name" : "head",
               "id" : "head",
               "spindle" : {
                  "max_speed" : 0,
                  "min_speed" : 0
               },
               "tool_station" : {
                  "coolants" : null,
                  "max_tool_diameter" : 0,
                  "max_tool_length" : 0
               },
               "type" : "head"
            }
         ],
         "units" : {
            "angle" : "degrees",
            "length" : "mm"
         }
      }
   },
   "machining" : {
      "default" : {
         "feedrate_ratio" : 1,
         "tool_change_time" : 15
      }
   },
   "post" : {
      "default" : {
         "output_folder" : "C:\\Users\\chris\\Downloads",
         "path" : "cloud://export cnc file to vs code.cps"
      }
   },
   "tooling" : {
      "default" : {
         "has_tool_changer" : true,
         "number_of_tools" : 100,
         "supports_tool_preload" : true
      }
   }
}

   ?   http://www.cimco-software.com/namespace/nc/parameter/stock-type   b o x       kind   
   :   http://www.cimco-software.com/namespace/nc/parameter/stock   ((0, 0, -1), (102, 52, 0))             ��  �B  PB          kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-x              kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-y              kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-z      �      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-x     �Y@      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-y      J@      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-z        �     PartReference   ModelCS      I@      9@              �?       �                              �?�     TableAttach	   MachineCS                              �?       �                              �?�     UserTableAttach   TableAttach                              �?                                      �?   1   http://www.cimco-software.com/namespace/nc/marker       :   http://www.cimco-software.com/namespace/nc/parameter/notes    
   G   http://www.cimco-software.com/namespace/nc/parameter/operation-strategy   jet2d   F   http://www.cimco-software.com/namespace/nc/parameter/operation-comment   2 D   P r o f i l e 1       autodeskcam:operation-id         leads-supported         autodeskcam:path   S e t u p s \ S e t u p 1 \ 2 D   P r o f i l e 1       operation:is2DStrategy         operation:is3DStrategy          operation:isRoughingStrategy          operation:isFinishingStrategy         operation:isMillingStrategy          operation:isTurningStrategy          operation:isJetStrategy         operation:isAdditiveStrategy          operation:isProbingStrategy          operation:isInspectionStrategy          operation:isDrillingStrategy          operation:isHoleMillingStrategy          operation:isThreadStrategy          operation:isSamplingStrategy          operation:isRotaryStrategy       $   operation:isSecondarySpindleStrategy          operation:isSurfaceStrategy           operation:isCheckSurfaceStrategy          operation:isMultiAxisStrategy          operation:advancedMode          operation:betaMode          operation:alphaMode          operation:isXpress          operation:licenseMultiaxis         operation:license3D         operation:metric         operation:isAssemblyDocument   
      operation:context	   operation
      operation:strategy   jet2d
      operation:operation_description    
      operation:tool_type   laser cutter      operation:tool_isTurning          operation:tool_isMill          operation:tool_isDrill          operation:tool_isJet         operation:tool_isDepositing    
      operation:tool_unit   millimeters      operation:tool_number         operation:tool_diameterOffset   
      operation:tool_description   Acrylic - CO2 glass
      operation:tool_comment    
      operation:tool_vendor    
      operation:tool_productId          kind         operation:tool_segmentHeight      $@      kind      #   operation:tool_segmentDiameterLower      $@      kind      #   operation:tool_segmentDiameterUpper      $@      kind      !   operation:tool_shaftSegmentHeight      �?      kind      (   operation:tool_shaftSegmentDiameterLower      �?      kind      (   operation:tool_shaftSegmentDiameterUpper      �?      kind         operation:tool_kerfWidth�������?      kind         operation:tool_nozzleDiameter�������?      kind         operation:tool_headClearance      �?
   $   operation:tool_machineQualityControl   manual      operation:holder_attached    
      operation:holder_description    
      operation:holder_comment    
      operation:holder_vendor    
      operation:holder_productId    
      operation:holder_productLink    
      operation:holder_libraryName    
      operation:tool_productLink    
      operation:cuttingMode   auto      kind         operation:kerfWidth�������?
      operation:machineQualityControl   manual      kind         operation:tool_feedCutting      �@      kind         operation:tool_feedEntry      �@      kind         operation:tool_feedExit      �@
      operation:featureOperationId   none      kind         operation:surfaceZHigh      �      kind         operation:surfaceZLow      �      kind         operation:surfaceXLow      �?      kind         operation:surfaceXHigh     @Y@      kind         operation:surfaceYLow      �?      kind         operation:surfaceYHigh     �I@      kind         operation:stockZHigh              kind         operation:stockZLow      �      kind         operation:stockXLow              kind         operation:stockXHigh     �Y@      kind         operation:stockYLow              kind         operation:stockYHigh      J@      operation:selectCoPlanarFaces    
      operation:contours_loops   all
      operation:contours_side   start-outside      kind         operation:tabWidth      @
      operation:tabPositioning   distance
      operation:tabApproach   contour      operation:tabsPerContour         kind         operation:tabDistance      I@
      operation:clearanceHeight_mode   from retract height      kind          operation:clearanceHeight_offset      $@      kind         operation:clearanceHeight_value      .@   "   operation:clearanceHeight_absolute   
      operation:retractHeight_mode   from stock top      kind         operation:retractHeight_offset      @      kind         operation:retractHeight_value      @       operation:retractHeight_absolute   
      operation:topHeight_mode   from stock top      kind         operation:topHeight_offset              kind         operation:topHeight_value              operation:topHeight_absolute         kind         operation:tolerance{�G�z�?      kind         operation:contourTolerance{�G�zt?      kind         operation:calculationTolerance{�G�z�?      kind         operation:chainingTolerance{�G�z�?      kind         operation:gougingTolerance{�G�z�?
      operation:compensation   left
      operation:compensationType   computer      kind         operation:finishingOverlap        
      operation:cornerMode   roll      operation:preserveOrder          operation:bothWaysJL          kind         operation:stockToLeave              kind      "   operation:smoothingFilterTolerance              kind         operation:reducedFeedChange      9@      kind         operation:reducedFeedRadius              kind         operation:reducedFeedDistance              kind         operation:reducedFeedrate      |@       operation:reduceOnlyInnerCorners          operation:keepToolDown          kind         operation:stayDownDistance              kind      "   operation:minimumStayDownClearance              kind      $   operation:minimumStayDownClearanceJl           "   operation:forceRetractForInsideCut          kind         operation:noEngagementFeedrate      �@      operation:doLeadIn   
      operation:entry_style   smooth      kind         operation:entry_radius              kind         operation:entry_sweep      N@      kind         operation:entry_distance      �?      kind         operation:leadInRadius              operation:doLeadOut         operation:exit_sameAsEntry   
      operation:exit_style   smooth      kind         operation:exit_radius              kind         operation:exit_sweep      N@      kind         operation:exit_distance      �?      kind         operation:leadOutRadius              kind         operation:pierceClearance�������?      kind         operation:tool_cutHeight      �?      kind         operation:tool_cutPower      T@      kind         operation:tool_pierceHeight      @      kind         operation:tool_pierceTime      �?      kind         operation:tool_piercePower      T@
      operation:tool_assistGas   on      kind         operation:tool_pressure      �?      kind         operation:tool_abrasiveFlowRate      �?
              ��  ��  �?  �?              �?              �?  ��  ��  �?  �?              �?              �?             �                                                              �������?�������?      �?      @              �?      �?              T@      T@   o n    m a n u a l    1                                                                                                                                                        pΘ@�@��Ao�?��A    33KA\�"@33KA    33�A$�A  �A33�A  �A   X   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-description   A c r y l i c   -   C O 2   g l a s s    T   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-comment       S   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-vendor       W   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-product-id       _   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-description       [   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-comment       Z   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-vendor       ^   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-product-id          movement:lead_in      �@      movement:cutting      �@      movement:lead_out      �@      movement:transition      �@      movement:direct      �@      movement:helix_ramp      �@      movement:profile_ramp      �@      movement:zigzag_ramp      �@      movement:ramp      �@      movement:plunge              movement:predrill      �@      movement:extended      �@      movement:reduced      �@      movement:finish_cutting      �@      movement:high_feed              movement:depositing                       e   \ӽ?$��?  pA    e   \ӽ?$��?        �      
      action   pierced   ff�?$��?      �D   d   ff�?ff�?      �D  d   f��Bff�?      �D   d   f��B��KB      �D   d     0A��KB      �D   n   ff�?  $B      0A  $B              �?  �D   d   ff�?$��?      �D  d   \ӽ?$��?      �D   �      e   \ӽ?$��?  pA       