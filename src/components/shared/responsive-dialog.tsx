"use client"

import * as React from "react"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

const MOBILE_QUERY = "(max-width: 639px)"

const ResponsiveContext = React.createContext(false)

function ResponsiveDialog({
  children,
  ...props
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const Root = isMobile ? Drawer : Dialog

  return (
    <ResponsiveContext.Provider value={isMobile}>
      <Root {...props}>{children}</Root>
    </ResponsiveContext.Provider>
  )
}

function ResponsiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />
}

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  showCloseButton?: boolean
} & Omit<React.ComponentProps<"div">, "className">) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? (
    <DrawerContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DrawerContent>
  ) : (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

function ResponsiveDialogHeader(
  props: React.ComponentProps<typeof DialogHeader>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? <DrawerHeader {...props} /> : <DialogHeader {...props} />
}

function ResponsiveDialogFooter(
  props: React.ComponentProps<typeof DialogFooter>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? <DrawerFooter {...props} /> : <DialogFooter {...props} />
}

function ResponsiveDialogTitle(
  props: React.ComponentProps<typeof DialogTitle>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />
}

function ResponsiveDialogDescription(
  props: React.ComponentProps<typeof DialogDescription>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? (
    <DrawerDescription {...props} />
  ) : (
    <DialogDescription {...props} />
  )
}

function ResponsiveDialogClose(
  props: React.ComponentProps<typeof DialogClose>
) {
  const isMobile = React.useContext(ResponsiveContext)
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
}
